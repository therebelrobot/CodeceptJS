'use strict';
let event = require('./event');
let container = require('./container');
let recorder = require('./recorder');
let getParamNames = require('./utils').getParamNames;

global.pause = require('./pause');
global.within = require('./within');

/**
 * Wraps test function, injects support objects from container,
 * starts promise chain with recorder, performs before/after hooks
 * through event system.
 */
module.exports.test = (test) => {
  let testFn = test.fn;
  if (!testFn) {
    return test;
  }

  test.steps = [];
  test.fn = function () {
    recorder.errHandler(function (err){
      event.dispatcher.emit(event.test.failed, test, err);
      throw err;
    });

    try {
      event.dispatcher.emit(event.test.started, test);
      let res = testFn.apply(test, getInjectedArguments(testFn));

      if (isGenerator(testFn)) {
        res.next(); // running test
        recorder.catch(); // catching possible errors in promises
        let resumeTest = function () {
          recorder.add(function (data) {
            recorder.reset(); // creating a new promise chain
            try {
              let resume = res.next(data);
              if (!resume.done) resumeTest();
            } catch (err) {
              recorder.throw(err);
              recorder.catch();
            }
          });
        };
        resumeTest();
      }
    } catch (err) {
      recorder.throw(err);
    } finally {
      if (!isGenerator(testFn)) recorder.catch();
    }
    return recorder.promise();
  };
  return test;
};

/**
 * Injects arguments to function from controller
 */
module.exports.injected = function (fn) {
  return function () {
    try {
      fn.apply(this, getInjectedArguments(fn));
    } catch (err) {
      recorder.throw(err);
    }
    return recorder.promise();
  };
};

/**
 * Starts promise chain, so helpers could enqueue their hooks
 */
module.exports.setup = function () {
  recorder.start();
  event.dispatcher.emit(event.test.before);
};

module.exports.teardown = function () {
  recorder.start();
  event.dispatcher.emit(event.test.after);
};

function isGenerator(fn) {
  return fn.constructor.name === 'GeneratorFunction';
}

function getInjectedArguments(fn)
{
  let testArguments = [];
  let params = getParamNames(fn) || [];
  let objects = container.support();
  for (var key in params) {
    let obj = params[key];
    if (!objects[obj]) {
      throw new Error(`Object of type ${obj} is not defined in container`);
    }
    testArguments.push(container.support(obj));
  }
  return testArguments;
}
