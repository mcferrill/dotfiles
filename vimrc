
set exrc
set secure

scriptencoding utf-8
set encoding=utf-8

set mouse=a
if !has('nvim')
if has("mouse_sgr")
    set ttymouse=sgr
else
    set ttymouse=xterm2
end
end
set bs=2
let mapleader = ","
set noswapfile

" Use four spaces for indentation in general
set tabstop=4
set softtabstop=4
set shiftwidth=4
set shiftround
set expandtab

" Searching
set hlsearch
set ignorecase
set smartcase

" Backups and persistent undo
set undodir=~/.vim/tmp/undo/
set undofile
set undolevels=1000
set undoreload=10000
set backupdir=~/.vim/tmp/backup/
set backup

" Clipboard
set pastetoggle=<F2>
if $TMUX == ''
    set clipboard+=unnamed
endif

" Quicksave with <Ctrl>-Z
noremap <C-Z> :update<CR>
vnoremap <C-Z> <C-C>:update<CR>
inoremap <C-Z> <C-O>:update<CR>

" Quick exit with leader-e or leader-E (close all)
noremap <Leader>e :quit<CR>  " Quit current window
noremap <Leader>E :qa!<CR>   " Quit all windows

" Select all with leader-a
map <Leader>a ggVG

" Switch tabs with leader-m/n
map <Leader>n <esc>:tabprevious<CR>
map <Leader>m <esc>:tabnext<CR>

" Sorting lines with leader-s
vnoremap <Leader>s :sort<CR>

" Disable arrow keys for navigation
nnoremap <up> <nop>
nnoremap <down> <nop>
nnoremap <left> <nop>
nnoremap <right> <nop>
inoremap <up> <nop>
inoremap <down> <nop>
inoremap <left> <nop>
inoremap <right> <nop>

" Move the cursor in insert mode by holding CTRL
imap <C-h> <C-o>h
imap <C-j> <C-o>j
imap <C-k> <C-o>k
imap <C-l> <C-o>l

" Indent and dedent with tab and shift-tab (very useful in visual block mode)
vnoremap < <gv
vnoremap > >gv
nnoremap <Tab> >>_
nnoremap <S-Tab> <<_
inoremap <S-Tab> <C-D>
vnoremap <Tab> >gv
vnoremap <S-Tab> <gv

" Show whitespace with leader-l
"nmap <leader>l :set list!<CR>
set listchars=tab:▸\ ,eol:¬

" Line numbers, document width, and wrapping
set number  " show line numbers
set tw=79   " width of document (used by gd)
set nowrap  " don't automatically wrap on load
set fo-=t   " don't automatically wrap text when typing

" Force .md files to be read as markdown
autocmd BufNewFile,BufReadPost *.md set filetype=markdown

" Use two spaces for indentation where appropriate
autocmd FileType ada setlocal shiftwidth=2 tabstop=2
autocmd FileType yaml setlocal ts=2 sts=2 sw=2 expandtab
autocmd FileType html setlocal ts=2 sts=2 sw=2 expandtab
autocmd FileType javascript setlocal ts=2 sts=2 sw=2 expandtab
autocmd FileType vue setlocal ts=2 sts=2 sw=2 expandtab
autocmd FileType json setlocal ts=2 sts=2 sw=2 expandtab
autocmd FileType twig setlocal ts=2 sts=2 sw=2 expandtab
autocmd FileType css setlocal ts=2 sts=2 sw=2 expandtab

" Smarty syntax highlighting
au BufRead,BufNewFile *.tpl set filetype=smarty


" Third Party Addons "

" Invoke pathogen to automagically load plugins, themes, etc.
" call pathogen#infect()

" Set theme based on light or dark mode
if ($USER_THEME == 'light')
    set background=light
    " let g:airline_theme='github'
    colorscheme github
else
    set background=dark
    colorscheme wombat
endif

" ctrlp
let g:ctrlp_max_height = 30
set wildignore+=*.pyc
set wildignore+=*build/*
set wildignore+=*dist/*
set wildignore+=*obj/*
set wildignore+=*__pypackages__/*
set wildignore+=*__pycache__/*
set wildignore+=*/coverage/*
set wildignore+=.tox*
set wildignore+=*.o
set wildignore+=*/tmp/*,*.so,*.swp,*.zip     " MacOSX/Linux
set wildignore+=*\\tmp\\*,*.swp,*.zip,*.exe  " Windows
set wildignore+=*node_modules*

" NerdTree
nmap <silent> <C-D> :NERDTreeToggle<CR>
let NERDTreeIgnore = ['\.py[co]$', '__pycache__$']

" Neomake
call neomake#configure#automake('nrwi', 500)

" DelimitMate
let delimitMate_expand_cr = 1
