import { type Plugin, tool } from "@opencode-ai/plugin"
import { google, youtube_v3 } from "googleapis"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

interface YouTubeCommentsConfig {
  apiKey?: string
}

/**
 * Get the API key from config file or environment variable
 * Priority: 1. Config file, 2. Environment variable
 */
function getApiKey(): { apiKey: string | undefined; source: string; configPath: string; configError?: string } {
  const configPath = path.join(os.homedir(), ".config", "opencode", "plugins", "youtube-comments.json")
  
  // Try config file first
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf-8")
      const config: YouTubeCommentsConfig = JSON.parse(configContent)
      if (config.apiKey) {
        return { apiKey: config.apiKey, source: "config file", configPath }
      }
      return { apiKey: undefined, source: "none", configPath, configError: "Config file exists but 'apiKey' field is missing or empty" }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { apiKey: undefined, source: "none", configPath, configError: `Failed to read config file: ${errorMsg}` }
  }
  
  // Fall back to environment variable
  const envKey = process.env.YOUTUBE_API_KEY
  if (envKey) {
    return { apiKey: envKey, source: "environment variable", configPath }
  }
  
  return { apiKey: undefined, source: "none", configPath }
}

type ChannelUrlInfo =
  | { type: "id"; value: string }
  | { type: "handle"; value: string }
  | { type: "custom"; value: string }

/**
 * Parse a YouTube channel URL and extract the identifier
 * Supports formats:
 * - https://youtube.com/channel/UCxxxxx (channel ID)
 * - https://youtube.com/@handle (handle)
 * - https://youtube.com/c/customname (custom URL)
 * - https://youtube.com/user/username (legacy username)
 */
function parseChannelUrl(url: string): ChannelUrlInfo {
  // Clean up the URL
  const cleanUrl = url.trim()

  // Handle direct channel ID (not a URL)
  if (cleanUrl.startsWith("UC") && !cleanUrl.includes("/")) {
    return { type: "id", value: cleanUrl }
  }

  // Handle @handle format (not a full URL)
  if (cleanUrl.startsWith("@")) {
    return { type: "handle", value: cleanUrl }
  }

  try {
    const urlObj = new URL(cleanUrl)
    const pathname = urlObj.pathname

    // /channel/UCxxxxx format
    const channelMatch = pathname.match(/^\/channel\/(UC[\w-]+)/)
    if (channelMatch) {
      return { type: "id", value: channelMatch[1] }
    }

    // /@handle format
    const handleMatch = pathname.match(/^\/@([\w.-]+)/)
    if (handleMatch) {
      return { type: "handle", value: `@${handleMatch[1]}` }
    }

    // /c/customname format
    const customMatch = pathname.match(/^\/c\/([\w.-]+)/)
    if (customMatch) {
      return { type: "custom", value: customMatch[1] }
    }

    // /user/username format (legacy)
    const userMatch = pathname.match(/^\/user\/([\w.-]+)/)
    if (userMatch) {
      return { type: "custom", value: userMatch[1] }
    }

    throw new Error(`Could not parse channel identifier from URL: ${url}`)
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        `Invalid URL format: ${url}. Expected a YouTube channel URL like https://youtube.com/@channelname`
      )
    }
    throw e
  }
}

/**
 * Resolve a channel handle or custom URL to a channel ID
 */
async function resolveChannelId(
  youtube: youtube_v3.Youtube,
  urlInfo: ChannelUrlInfo
): Promise<{ channelId: string; channelTitle: string }> {
  if (urlInfo.type === "id") {
    // Fetch channel info to get the title
    const response = await youtube.channels.list({
      part: ["snippet"],
      id: [urlInfo.value],
    })

    const channel = response.data.items?.[0]
    if (!channel) {
      throw new Error(`Channel not found with ID: ${urlInfo.value}`)
    }

    return {
      channelId: urlInfo.value,
      channelTitle: channel.snippet?.title || "Unknown Channel",
    }
  }

  // For handles and custom URLs, search for the channel
  const searchQuery = urlInfo.type === "handle" ? urlInfo.value : urlInfo.value

  const response = await youtube.search.list({
    part: ["snippet"],
    q: searchQuery,
    type: ["channel"],
    maxResults: 1,
  })

  const channel = response.data.items?.[0]
  if (!channel || !channel.snippet?.channelId) {
    throw new Error(
      `Could not find channel for ${urlInfo.type}: ${urlInfo.value}`
    )
  }

  return {
    channelId: channel.snippet.channelId,
    channelTitle: channel.snippet.title || "Unknown Channel",
  }
}

/**
 * Format a date string to a readable format
 */
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Unknown date"

  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + "..."
}

interface CommentInfo {
  videoId: string
  videoTitle: string
  commentId: string
  authorName: string
  publishedAt: string
  text: string
  commentUrl: string
}

/**
 * Generate a direct link to a YouTube comment
 */
function getCommentUrl(videoId: string, commentId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`
}

export const YouTubeCommentsPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      youtube_comments: tool({
        description:
          "List recent comments on a YouTube channel. Provide a YouTube channel URL (supports youtube.com/@handle, youtube.com/channel/ID, youtube.com/c/name formats).",
        args: {
          channelUrl: tool.schema
            .string()
            .describe(
              "YouTube channel URL (e.g., https://youtube.com/@channelname)"
            ),
          maxResults: tool.schema
            .number()
            .min(1)
            .max(100)
            .optional()
            .describe("Maximum number of comments to return (default: 20, max: 100)"),
        },
        async execute(args, context) {
          // Get API key from config file or environment variable
          const { apiKey, source, configPath, configError } = getApiKey()

          if (!apiKey) {
            return `Error: YouTube API key not configured.

To set up the plugin, create a config file at:
  ${configPath}

With the following content:
{
  "apiKey": "YOUR_YOUTUBE_API_KEY_HERE"
}

Alternatively, set the YOUTUBE_API_KEY environment variable.

To get an API key:
1. Go to https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Create credentials (API key)
5. Copy the API key to the config file above${configError ? `\n\nConfig error: ${configError}` : ''}`
          }

          const maxResults = args.maxResults || 20

          try {
            // Initialize YouTube API client
            const youtube = google.youtube({
              version: "v3",
              auth: apiKey,
            })

            // Parse the channel URL
            const urlInfo = parseChannelUrl(args.channelUrl)

            // Resolve to channel ID and get channel name
            const { channelId, channelTitle } = await resolveChannelId(
              youtube,
              urlInfo
            )

            // Fetch comment threads for the channel
            const commentsResponse = await youtube.commentThreads.list({
              part: ["snippet"],
              allThreadsRelatedToChannelId: channelId,
              maxResults: Math.min(maxResults, 100),
              order: "time",
              textFormat: "plainText",
            })

            const commentThreads = commentsResponse.data.items || []

            if (commentThreads.length === 0) {
              return `No recent comments found for channel "${channelTitle}".

This could mean:
- The channel has comments disabled
- The channel has no recent videos with comments
- The channel's videos have comments turned off`
            }

            // To get video titles, we need to fetch video info
            // Get unique video IDs
            const videoIds = [
              ...new Set(
                commentThreads
                  .map((t) => t.snippet?.videoId)
                  .filter((id): id is string => !!id)
              ),
            ]

            // Fetch video details if we have video IDs
            const videoTitles: Record<string, string> = {}
            if (videoIds.length > 0) {
              try {
                const videosResponse = await youtube.videos.list({
                  part: ["snippet"],
                  id: videoIds.slice(0, 50), // API limit
                })

                for (const video of videosResponse.data.items || []) {
                  if (video.id && video.snippet?.title) {
                    videoTitles[video.id] = video.snippet.title
                  }
                }
              } catch {
                // If video fetch fails, continue without titles
              }
            }

            // Update comments with video titles and comment links
            const enrichedComments: CommentInfo[] = commentThreads.map((thread) => {
              const snippet = thread.snippet
              const topComment = snippet?.topLevelComment?.snippet
              const videoId = snippet?.videoId || ""
              const commentId = snippet?.topLevelComment?.id || ""

              return {
                videoId,
                videoTitle: videoTitles[videoId] || "Unknown Video",
                commentId,
                authorName: topComment?.authorDisplayName || "Unknown",
                publishedAt: topComment?.publishedAt || "",
                text: topComment?.textDisplay || "",
                commentUrl: getCommentUrl(videoId, commentId),
              }
            })

            // Format output
            const output: string[] = [
              `Recent comments on ${channelTitle}:`,
              "",
            ]

            enrichedComments.forEach((comment, index) => {
              output.push(`${index + 1}. ${comment.videoTitle}`)
              output.push(
                `   Author: ${comment.authorName} | Posted: ${formatDate(comment.publishedAt)}`
              )
              output.push(`   "${truncateText(comment.text)}"`)
              output.push(`   Link: ${comment.commentUrl}`)
              output.push("")
            })

            output.push(`Total: ${enrichedComments.length} comments`)

            return output.join("\n")
          } catch (error) {
            // Enhanced debugging for all errors
            const errorDebug = {
              apiKeyPresent: !!apiKey,
              apiKeySource: source,
              apiKeyLength: apiKey?.length || 0,
              apiKeyPrefix: apiKey?.substring(0, 8) || 'N/A',
              errorName: error instanceof Error ? error.name : 'Unknown',
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : 'N/A',
              fullError: JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2),
            }

            if (error instanceof Error) {
              // Handle specific API errors
              if (error.message.includes("quotaExceeded")) {
                return `Error: YouTube API quota exceeded. The daily quota limit has been reached. Please try again tomorrow or use a different API key.

DEBUG INFO:
${JSON.stringify(errorDebug, null, 2)}`
              }

              if (
                error.message.includes("forbidden") ||
                error.message.includes("403")
              ) {
                return `Error: Access forbidden. This could mean:
- The API key is invalid or restricted
- The YouTube Data API v3 is not enabled for this project
- The channel has restricted access to comments

Please verify your API key and ensure the YouTube Data API v3 is enabled.

DEBUG INFO:
${JSON.stringify(errorDebug, null, 2)}`
              }

              if (error.message.includes("commentsDisabled")) {
                return `Error: Comments are disabled for this channel's videos.

DEBUG INFO:
${JSON.stringify(errorDebug, null, 2)}`
              }

              return `Error fetching comments: ${error.message}

DEBUG INFO:
${JSON.stringify(errorDebug, null, 2)}`
            }

            return `An unexpected error occurred while fetching comments.

DEBUG INFO:
${JSON.stringify(errorDebug, null, 2)}`
          }
        },
      }),
    },
  }
}
