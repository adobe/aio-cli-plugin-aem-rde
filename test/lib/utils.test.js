const { sleepSeconds } = require('../../src/lib/utils');
const assert = require('node:assert');
const sinon = require('sinon');

// describe('Utils', () => {
//   before(() => {
//     this.clock = sinon.useFakeTimers();
//   });
//   after(() => {
//     this.clock = null;
//   });
//   it('sleep seconds', async () => {
//     let isFinished = false;
//     sleepSeconds(5).then(() => {
//       isFinished = true;
//     });
//     await this.clock.tickAsync(6000);
//     assert.ok(isFinished);
//   });
//   it('sleep without resolving', async () => {
//     let isFinished = false;
//     sleepSeconds(5).then(() => {
//       isFinished = true;
//     });
//     await sinon.clock.tickAsync(3000);
//     assert.ok(!isFinished);
//   });
//   it('sleep 0 seconds', async () => {
//     let isFinished = false;
//     sleepSeconds(0).then(() => {
//       isFinished = true;
//     });
//     await sinon.clock.tickAsync(0);
//     assert.ok(isFinished);
//   });
// });
