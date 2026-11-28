// Run: node ~/.config/omarchy/plugins/mcferrill.lock/check-policy.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lock = fs.readFileSync(path.join(__dirname, 'Service.qml'), 'utf8');
const idle = fs.readFileSync(path.join(__dirname, '../mcferrill.idle/Service.qml'), 'utf8');
const predicate = source => source.match(/readonly property bool dockedOnAc: (.+)/)[1];
assert.equal(predicate(lock), predicate(idle));
for (const battery of [false, true]) {
  for (const name of ['HDMI-A-1', 'DP-1', 'eDP-1']) {
    for (const width of [0, 2560]) {
      const context = { UPower: { onBattery: battery }, Quickshell: { screens: [{ name, width, height: 1440 }] } };
      const docked = vm.runInNewContext(predicate(lock), context);
      assert.equal(docked, !battery && name === 'HDMI-A-1' && width > 0);
      context.dockedOnAc = docked;
      context.idleConfig = { screensaver: 150, lock: 300 };
      context.secondsFromConfig = (value, fallback) => value ?? fallback;
      context.defaultScreensaverSeconds = 150;
      context.defaultLockSeconds = 300;
      for (const [key, expected] of [['screensaver', docked ? 300 : 150], ['lock', docked ? 600 : 300]]) {
        const expression = idle.match(new RegExp(`readonly property int ${key}TimeoutSeconds: (.+)`))[1];
        assert.equal(vm.runInNewContext(expression, context), expected);
      }
    }
  }
}
function call(name, context) {
  const body = lock.match(new RegExp(`  function ${name}\\(\\) \\{\\n([\\s\\S]*?)\\n  \\}`))[1];
  vm.runInNewContext(body, context);
}
for (const dockedOnAc of [false, true]) {
  let paused = false;
  const context = { dockedOnAc, softBlank: false, pauseFingerprint: () => { paused = true; }, blankProcess: { running: false } };
  call('runBlank', context);
  assert.equal(paused, true);
  assert.equal(context.softBlank, dockedOnAc);
  assert.equal(context.blankProcess.running, !dockedOnAc);
}
let armed = false;
const context = { softBlank: true, lockRequested: true, wakeProcess: { running: false }, armBlankTimer: () => { armed = true; }, resumeFingerprint() {}, nudgeFingerprint() {} };
call('runWake', context);
assert.equal(context.softBlank, false);
assert.equal(context.wakeProcess.running, true);
assert.equal(armed, true);
assert(lock.includes('opacity: root.softBlank ? 0 : 1'));
assert(lock.includes('color: root.softBlank ? "black"'));
console.log('Passed: AC/HDMI policy, battery timers, soft blank without DPMS, input wake.');
