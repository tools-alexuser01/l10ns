
global.lcf = {
  TRANSLATION_FUNCTION_CALL_REGEX: /gt\(['|"](.*?)['|"]\s*(\,\s*\{\s*((.*?)|(\s*?))+?\s*\})??\s*\)/g,
  TRANSLATION_INNER_FUNCTION_CALL_REGEX: /\s+(?!gt)[.|\w]+?\((.*?\s*?)*?\)/g
};

global.pcf = {

};

var dependencies = {
  'fs': {},
  'readline': {},
  'underscore': {},
  'path': {},
  './parser': {},
  './syntax': {},
  './merger': {},
  './file': {},
  './_log': {}
};

describe('Update', function() {
  describe('#update()', function() {
    it('should get the source keys', function() {
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._getSourceKeys = sinon.spy();
      update._mergeTranslations = function() {};
      update.update();
      update._getSourceKeys.should.have.been.calledOnce;
    });

    it('should merge source keys with old translations', function() {
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._getSourceKeys = function() {};
      update._mergeTranslations = sinon.spy();
      update.update();
      update._mergeTranslations.should.have.been.calledOnce;
    });

    it('should write all the translation to storage', function() {
      dependencies['./file'].writeTranslations = sinon.spy();
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._getSourceKeys = function() {};
      update._mergeTranslations = sinon.stub().callsArgWith(1, null, {});
      update.update();
      dependencies['./file'].writeTranslations.should.have.been.calledOnce;
      dependencies['./file'].writeTranslations.should.have.been.calledWith({});
    });

    it('should log an error if merge translations have been failed', function() {
      dependencies['./file'].writeTranslations = function() {};
      dependencies['./_log'].error = sinon.spy();
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._getSourceKeys = function() {};
      update._mergeTranslations = sinon.stub().callsArgWith(1, new Error('test'), {});
      update.update();
      dependencies['./_log'].error.should.have.been.calledOnce;
      dependencies['./_log'].error.should.have.been.calledWith('Translation update failed');
    });
  });

  describe('#_stripInnerFunctionCalls()', function() {
    it('should remove inner function calls', function() {
      var callString = 'gt(\'TRANSLATION_KEY\', { innerFunction: innerFunction() });';
      var resultString = 'gt(\'TRANSLATION_KEY\', { innerFunction: });';
      var method = proxyquire('../libraries/update', dependencies).Update.prototype._stripInnerFunctionCalls;
      expect(method(callString)).to.equal(resultString);
    });

    it('should not remove inner gt function calls', function() {
      var callString = 'gt(\'TRANSLATION_KEY\', { innerFunction: gt() });';
      var resultString = 'gt(\'TRANSLATION_KEY\', { innerFunction: gt() });';
      var method = proxyquire('../libraries/update', dependencies).Update.prototype._stripInnerFunctionCalls;
      expect(method(callString)).to.equal(resultString);
    });
  });

  describe('#_getSourceKeys()', function() {
    describe('should loop through each file path and...', function() {
      it('check if the file path is a directory', function() {
        pcf.src = ['./file.js'];
        dependencies['fs'].lstatSync = sinon.stub().returns({
          isDirectory: sinon.stub().returns(true)
        });
        var update = new (proxyquire('../libraries/update', dependencies).Update);
        update._getSourceKeys();
        dependencies['fs'].lstatSync.should.have.been.calledOnce;
      });

      it('read the file', function() {
        pcf.src = ['./file.js'];
        dependencies['fs'].lstatSync = sinon.stub().returns({
          isDirectory: sinon.stub().returns(false)
        });
        dependencies['fs'].readFileSync = sinon.spy();
        var update = new (proxyquire('../libraries/update', dependencies).Update);
        update._stripInnerFunctionCalls = sinon.stub().returns({ match: sinon.stub().returns(null) });
        update._getSourceKeys();
        dependencies['fs'].readFileSync.should.have.been.calledOnce;
        dependencies['fs'].readFileSync.should.have.been.calledWith(pcf.src[0]);
      });

      it('strip inner function calls', function() {
        pcf.src = ['./file.js'];
        dependencies['fs'].lstatSync = sinon.stub().returns({
          isDirectory: sinon.stub().returns(false)
        });
        dependencies['fs'].readFileSync = function() {};
        var update = new (proxyquire('../libraries/update', dependencies).Update);
        update._stripInnerFunctionCalls = sinon.stub().returns({ match: sinon.stub().returns(null) });
        update._getSourceKeys();
        update._stripInnerFunctionCalls.should.have.been.calledOnce;
      });

      it('find all gt() function call strings', function() {
        pcf.src = ['./file.js'];
        dependencies['fs'].lstatSync = sinon.stub().returns({
          isDirectory: sinon.stub().returns(false)
        });
        dependencies['fs'].readFileSync = function() {};
        var update = new (proxyquire('../libraries/update', dependencies).Update);
        var innerFunctionCallResultObject = { match: sinon.stub().returns(null) };
        update._stripInnerFunctionCalls = sinon.stub().returns(innerFunctionCallResultObject);
        update._getSourceKeys();
        innerFunctionCallResultObject.match.should.have.been.calledOnce;
      });

      it('get the key and variables on each gt() call strings', function() {
        pcf.src = ['./file.js'];
        dependencies['fs'].lstatSync = sinon.stub().returns({
          isDirectory: sinon.stub().returns(false)
        });
        dependencies['fs'].readFileSync = function() {};
        dependencies['./parser'].getKey = sinon.stub().returns('SOME_KEY');
        dependencies['./parser'].getVars = sinon.stub().returns(['test1', 'test2']);
        var Hashids = function() {}
        Hashids.prototype.encrypt = function() {};
        dependencies['hashids'] = Hashids;
        var update = new (proxyquire('../libraries/update', dependencies).Update);
        var innerFunctionCallResultObject = { match: sinon.stub().returns(['gt(\'SOME_KEY\')']) };
        update._stripInnerFunctionCalls = sinon.stub().returns(innerFunctionCallResultObject);
        update._getSourceKeys();
        dependencies['./parser'].getKey.should.have.been.calledOnce;
        dependencies['./parser'].getKey.should.have.been.calledWith('gt(\'SOME_KEY\')');
        dependencies['./parser'].getVars.should.have.been.calledOnce;
        dependencies['./parser'].getVars.should.have.been.calledWith('gt(\'SOME_KEY\')');
      });

      it('set properties id, key, vars, text, files', function() {
        pcf.src = ['./file.js'];
        dependencies['fs'].lstatSync = sinon.stub().returns({
          isDirectory: sinon.stub().returns(false)
        });
        dependencies['fs'].readFileSync = function() {};
        dependencies['./parser'].getKey = sinon.stub().returns('SOME_KEY');
        dependencies['./parser'].getVars = sinon.stub().returns(['test1', 'test2']);
        var Hashids = function() {}
        Hashids.prototype.encrypt = sinon.stub().returns('id');
        dependencies['hashids'] = Hashids;
        var update = new (proxyquire('../libraries/update', dependencies).Update);
        var innerFunctionCallResultObject = { match: sinon.stub().returns(['gt(\'SOME_KEY\')']) };
        update._stripInnerFunctionCalls = sinon.stub().returns(innerFunctionCallResultObject);
        var result = update._getSourceKeys();
        expect(result['SOME_KEY'].id).to.equal('id');
        expect(result['SOME_KEY'].text).to.equal('SOME_KEY');
        expect(result['SOME_KEY'].vars).to.eql(['test1', 'test2']);
        expect(result['SOME_KEY'].files).to.eql(pcf.src);
      });

      it('append file path if a translation key already exist on a different file', function() {
        pcf.src = ['./file1.js', './file2.js'];
        dependencies['fs'].lstatSync = sinon.stub().returns({
          isDirectory: sinon.stub().returns(false)
        });
        dependencies['fs'].readFileSync = function() {};
        dependencies['./parser'].getKey = sinon.stub().returns('SOME_KEY');
        dependencies['./parser'].getVars = sinon.stub().returns(['test1', 'test2']);
        dependencies['./syntax'].hasErrorDuplicate = sinon.stub().returns(false);
        var Hashids = function() {}
        Hashids.prototype.encrypt = sinon.stub().returns('id');
        dependencies['hashids'] = Hashids;
        var update = new (proxyquire('../libraries/update', dependencies).Update);
        var innerFunctionCallResultObject = { match: sinon.stub().returns(['gt(\'SOME_KEY\')']) };
        update._stripInnerFunctionCalls = sinon.stub().returns(innerFunctionCallResultObject);
        var result = update._getSourceKeys();
        expect(result['SOME_KEY'].files).to.eql(pcf.src);
      });

      it('if a function call have two different varriable set it should throw an error', function() {
        pcf.src = ['./file.js'];
        dependencies['fs'].lstatSync = sinon.stub().returns({
          isDirectory: sinon.stub().returns(false)
        });
        dependencies['fs'].readFileSync = function() {};
        dependencies['./parser'].getKey = sinon.stub().returns('SOME_KEY');
        dependencies['./parser'].getVars = sinon.stub();
        dependencies['./parser'].getVars.onCall(0).returns(['test1']);
        dependencies['./parser'].getVars.onCall(1).returns(['test1', 'test2']);
        dependencies['./syntax'].hasErrorDuplicate = sinon.stub().returns(true);
        var Hashids = function() {}
        Hashids.prototype.encrypt = sinon.stub().returns('id');
        dependencies['hashids'] = Hashids;
        var update = new (proxyquire('../libraries/update', dependencies).Update);
        var innerFunctionCallResultObject = { match: sinon.stub().returns(['gt(\'SOME_KEY\')', 'gt(\'SOME_KEY\')']) };
        update._stripInnerFunctionCalls = sinon.stub().returns(innerFunctionCallResultObject);
        var result = function() { update._getSourceKeys() };
        expect(result).to.throw(TypeError, 'You have defined a translation key (SOME_KEY) with different');
      });
    });
  });

  describe('#_mergeTranslations()', function() {
    it('should read old translations', function() {
      dependencies['./file'].readTranslations = sinon.spy();
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      pcf.locales = {};
      update._mergeUserInputs = function() {};
      update._mergeTranslations();
      dependencies['./file'].readTranslations.should.have.been.calledOnce;
    });

    it('if an old translation exists, it should merge with new translations', function() {
      dependencies['./file'].readTranslations = sinon.stub().returns({
        'en-US': {
          'key1': {}
        }
      });
      dependencies['./merger'].mergeTranslations = sinon.spy();
      dependencies['./merger'].mergeTimeStamp = sinon.spy();
      dependencies['./merger'].mergeId = sinon.spy();
      pcf.locales = { 'en-US': 'English (US)' };
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._mergeUserInputs = function() {};
      update._mergeTranslations({
        'key1': {}
      });

      dependencies['./merger'].mergeTranslations.should.have.been.calledOnce;
      dependencies['./merger'].mergeTimeStamp.should.have.been.calledOnce;
      dependencies['./merger'].mergeId.should.have.been.calledOnce;
    });

    it('if an old translation does not exists, it should create a new translation', function() {
      dependencies['./file'].readTranslations = sinon.stub().returns({
        'en-US': {}
      });
      pcf.locales = { 'en-US': 'English (US)' };
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._mergeUserInputs = sinon.spy();
      update._mergeTranslations({
        'key1': {}
      });

      expect(update._mergeUserInputs.args[0][0]['en-US']['key1']).to.contain.keys('values', 'timestamp');
      expect(update._mergeUserInputs.args[0][0]['en-US']['key1'].values).to.eql([]);
    });

    it('should merge with user input option', function() {
      dependencies['./file'].readTranslations = sinon.stub().returns({
        'en-US': {}
      });
      dependencies['./merger'].mergeTimeStamp = sinon.stub().returns(0);
      pcf.locales = { 'en-US': 'English (US)' };
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._mergeUserInputs = sinon.spy();
      update._mergeTranslations({
        'key1': {}
      });

      update._mergeUserInputs.should.have.been.calledOnce;
    });

    it('if merging of user inputs is without errors, it should callback with newTranslations', function() {
      dependencies['./file'].readTranslations = sinon.stub().returns({
        'en-US': {}
      });
      pcf.locales = { 'en-US': 'English (US)' };
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._mergeUserInputs = sinon.stub().callsArgWith(2, null, { 'new-translation': {} });
      var callback = sinon.spy();
      update._mergeTranslations({
        'key1': {}
      }, callback);

      callback.should.have.been.calledWith(null, { 'new-translation': {} });
    });

    it('if merging of user inputs is with a SIGINT error, it should callback with oldTranslations', function() {
      dependencies['./file'].readTranslations = sinon.stub().returns({
        'en-US': {}
      });
      pcf.locales = { 'en-US': 'English (US)' };
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._mergeUserInputs = sinon.stub().callsArgWith(2, { error: 'SIGINT' }, { 'new-translation': {} });
      var callback = sinon.spy();
      update._mergeTranslations({
        'key1': {}
      }, callback);

      callback.should.have.been.calledWith(null, { 'en-US': {} });
    });

    it('if merging of user inputs is with an error, it should callback with the error', function() {
      dependencies['./file'].readTranslations = sinon.stub().returns({
        'en-US': {}
      });
      pcf.locales = { 'en-US': 'English (US)' };
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      update._mergeUserInputs = sinon.stub().callsArgWith(2, { error: 'other-error' }, { 'new-translation': {} });
      var callback = sinon.spy();
      update._mergeTranslations({
        'key1': {}
      }, callback);

      callback.should.have.been.calledWith({ error: 'other-error' });
    });
  });

  describe('#_getDeletedTranslations()', function() {
    it('should return deleted translations keys', function() {
      pcf.locales = { 'en-US': 'English (US)' };
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      var oldTranslations = { 'en-US': { 'key1': {}}};
      var newTranslations = { 'en-US': { 'key2': {}}};
      expect(update._getDeletedTranslations(newTranslations, oldTranslations)).to.have.keys('key1');
    });

    it('should add deleted locales, timestamp and files', function() {
      pcf.locales = { 'en-US': 'English (US)', 'zh-CN': 'Chinese (Simplified)' };
      var update = new (proxyquire('../libraries/update', dependencies).Update);
      var oldTranslations = { 'en-US': { 'key1': { files: ['file1'] }}, 'zh-CN': { 'key1': { files: ['file1'] }}};
      var newTranslations = { 'en-US': { 'key2': {}}, 'zh-CN': { 'key2': {}}};
      expect(update._getDeletedTranslations(newTranslations, oldTranslations)['key1']).to.have.keys('en-US', 'zh-CN', 'timestamp', 'files');
    });
  });
});
