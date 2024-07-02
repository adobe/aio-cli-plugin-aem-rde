const assert = require('assert');
const sinon = require('sinon');
const DeployCommand = require('../../../../src/commands/aem/rde/install.js');

const rewire = require('rewire');
const install = rewire('../../../../src/commands/aem/rde/install.js');

describe('DeployCommand', function () {
  describe('#getType', function () {
    let deployCommand;
    let guessTypeStub;

    beforeEach(function () {
      deployCommand = new DeployCommand([]);
      guessTypeStub = sinon.stub(deployCommand, 'guessType');
    });

    afterEach(function () {
      guessTypeStub.restore();
    });

    it('should return the provided type directly', function () {
      const type = 'frontend';
      const { type: resultType } = deployCommand.getType(
        type,
        'fileName',
        'effectiveUrl',
        'inputPath',
        false,
        'originalUrl'
      );
      assert.equal(resultType, type);
    });

    it('should guess the type based on fileName when no type is provided', function () {
      guessTypeStub.returns(['guessedType']);
      const { type: resultType } = deployCommand.getType(
        null,
        'fileName',
        'effectiveUrl',
        'inputPath',
        false,
        'originalUrl'
      );
      assert.equal(resultType, 'guessedType');
    });

    it('should guess the type based on originalUrl when there is a redirect', function () {
      guessTypeStub.onFirstCall().returns(install.__get__('deploymentTypes'));
      guessTypeStub.onSecondCall().returns(['redirectType']);
      const { type: resultType } = deployCommand.getType(
        null,
        'fileName',
        'http://effective.url',
        'inputPath',
        false,
        'http://original.url'
      );
      assert.equal(resultType, 'redirectType');
    });

    it('should throw an error when guessing returns multiple types', function () {
      guessTypeStub.returns(['type1', 'type2']);
      assert.throws(() => {
        deployCommand.getType(
          null,
          'fileName',
          'effectiveUrl',
          'inputPath',
          false,
          'originalUrl'
        );
      }, /INVALID_GUESS_TYPE/);
    });

    it('should successfully guess a single type when no type is provided', function () {
      guessTypeStub.returns(['guessedType']);
      const { type: resultType } = deployCommand.getType(
        null,
        'fileName',
        'effectiveUrl',
        'inputPath',
        false,
        'originalUrl'
      );
      assert.equal(resultType, 'guessedType');
    });
  });
});
