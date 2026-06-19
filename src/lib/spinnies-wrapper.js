'use strict';

const OriginalSpinnies = require('spinnies');

class Spinnies {
  constructor(options = {}) {
    this.spinnies = new OriginalSpinnies(options);
    this.suspendedSpinners = [];
  }

  add(name, options) {
    this.spinnies.add(name, options);
  }

  succeed(name, options) {
    if (this.spinnies.spinners[name]) {
      this.spinnies.succeed(name, options);
    }
  }

  stopAll(newStatus) {
    this.spinnies.stopAll(newStatus);
  }

  suspendAll() {
    this.suspendedSpinners = structuredClone(this.spinnies.spinners);
    Object.keys(this.spinnies.spinners).forEach((name) => {
      this.spinnies.remove(name);
    });
  }

  resumeAll() {
    Object.entries(this.suspendedSpinners).forEach((entry) => {
      this.spinnies.add(entry[0], entry[1]);
    });
    this.suspendedSpinners = null;
  }
}

module.exports = Spinnies;
