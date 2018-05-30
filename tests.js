var hook = require('.');
var logger = {
  _log: '',
  log: function(msg) {
    this._log += msg;
  },
  flush: function() {
    var log = this._log;
    this._log = '';
    return log;
  }
};

var testObject = {
  testMethod: function(arg) {
    logger.log(arg);
    return arg;
  }
};
var __original = testObject.testMethod;

function assert(test, msg) {
  if (!test) {
    throw new Error(msg);
  }
}

function assertLog(expected) {
  var log = logger.flush();
  assert(
    log === expected,
    'log message ' + log + ' matches expected ' + expected
  );
}

function isReset() {
  assert(logger.flush() === '', 'log is empty');
  assert(testObject.testMethod === __original, 'test method is original');
}

var tests = [];
tests.push(['hook', function() {
  isReset();

  var unhook = hook(function(target, arguments){
    logger.log('hook');
    assert(target === __original, 'target is original');
    assert(arguments[0] === 'test', 'arg was `test`');
    assert(target.apply(this, arguments) === 'test', 'target returns expected value');
    return 'hook';
  }, testObject, 'testMethod');

  assert(testObject.testMethod !== __original, 'object is hooked');
  assert(testObject.testMethod('test') === 'hook', 'return val was changed');
  assertLog('hooktest');
  unhook();
  isReset();
}]);

tests.push(['preHook', function() {
  isReset();

  var unhook = hook.preHook(function(arg){
    logger.log('hook');
    assert(arg === 'test', 'arg was `test`');
    return 'hook';
  }, testObject, 'testMethod');

  assert(testObject.testMethod !== __original, 'object is hooked');
  assert(testObject.testMethod('test') === 'test', 'return val was unchanged');
  assertLog('hooktest');
  unhook();
  isReset();
}]);

tests.push(['postHook', function() {
  isReset();

  var unhook = hook.postHook(function(arg){
    logger.log('hook');
    assert(arg === 'test', 'arg was `test`');
    return 'hook';
  }, testObject, 'testMethod');

  assert(testObject.testMethod !== __original, 'object is hooked');
  assert(testObject.testMethod('test') === 'test', 'return val was unchanged');
  assertLog('testhook');
  unhook();
  isReset();
}]);

tests.push(['passThrough', function() {
  isReset();

  var unhook = hook.passThrough(function(arg, val){
    logger.log('hook');
    assert(arg === 'test', 'arg was `test`');
    assert(val === 'test', 'return value from original was `test`');
    return 'hook';
  }, testObject, 'testMethod');

  assert(testObject.testMethod !== __original, 'object is hooked');
  assert(testObject.testMethod('test') === 'hook', 'return val was changed');
  assertLog('testhook');
  unhook();
  isReset();
}]);

tests.push(['intercept', function() {
  isReset();

  var unhook = hook.intercept(function(arg){
    logger.log('hook');
    assert(arg === 'test', 'arg was `test`');
    return 'hook';
  }, testObject, 'testMethod');

  assert(testObject.testMethod !== __original, 'object is hooked');
  assert(testObject.testMethod('test') === 'hook', 'return val was changed');
  assertLog('testhook');
  unhook();
  isReset();
}]);

tests.push(['replace', function() {
  isReset();

  var unhook = hook.replace(function(arg){
    logger.log('hook');
    assert(arg === 'test', 'arg was `test`');
    return 'hook';
  }, testObject, 'testMethod');

  assert(testObject.testMethod !== __original, 'object is hooked');
  assert(testObject.testMethod('test') === 'hook', 'return val was changed');
  assertLog('hook');
  unhook();
  isReset();
}]);

tests.push(['prototype', function() {
  // An example of how to hook the prototype of things that utilize
  // prototypical inheritance.  This hooks the prototype's method, applying
  // the hook to all instances of thing Thing.
  var Thing = function(type) {
    this.type = type;
  };
  Thing.prototype.logType = function() {
    logger.log(this.type);
  };
  var __original = Thing.prototype.logType;

  assert(logger.flush() === '', 'log is empty');
  var thing1 = new Thing('1');
  var thing2 = new Thing('2');

  thing1.logType();
  assert(logger.flush() === '1', 'Thing 1 is fine');
  thing2.logType();
  assert(logger.flush() === '2', 'Thing 2 is fine');

  assert(thing1.logType === __original, 'Thing 1 has original log');
  assert(thing2.logType === __original, 'Thing 2 has original log');

  var unhook = hook.preHook(function(){
    logger.log('hook');
    assert(this instanceof Thing, '`this` is a Thing');
  }, Thing.prototype, 'logType');

  assert(thing1.logType !== __original, 'Thing 1 has been hooked');
  assert(thing2.logType !== __original, 'Thing 2 has been hooked');
  thing1.logType();
  assert(logger.flush() === 'hook1', 'Thing 1 was hooked');
  thing2.logType();
  assert(logger.flush() === 'hook2', 'Thing 2 was hooked');
  unhook();
  assert(thing1.logType === __original, 'Thing 1 has original log');
  assert(thing2.logType === __original, 'Thing 2 has original log');
}]);

tests.forEach(function(test) {
  var name = test[0];
  try {
    test[1]();
    console.log(name + ': PASS');
  } catch (e) {
    console.log(name + ': FAIL');
    console.error(e);
  }
});
