/**
 * Module dependencies.
 */

var Suite = require('mocha/lib/suite');
var Test = require('mocha/lib/test');
var event = require('../event');
var scenario = require('../scenario');
var escapeRe = require('escape-string-regexp');

/**
 * Codecept-style interface:
 *
 * Feature('login')
 * Scenario('login as regular user', (I) {
 *   I.fillField();
 *   I.click()
 *   I.see('Hello, '+data.login);
 * });
 *
 * @param {Suite} suite Root suite.
 */
module.exports = function (suite) {
  var suites = [suite];

  suite.on('pre-require', function (context, file, mocha) {
    var common = require('mocha/lib/interfaces/common')(suites, context);

    common.before('codeceptjs event', function () {
      event.dispatcher.emit(event.suite.before);
    });

    common.after('codeceptjs event', function () {
      event.dispatcher.emit(event.suite.after);
    });

    // create dispatcher

    context.BeforeAll = common.before;
    context.AfterAll = common.after;

    context.run = mocha.options.delay && common.runWithSuite(suite);
    /**
     * Describe a "suite" with the given `title`
     * and callback `fn` containing nested suites
     * and/or tests.
     */

    context.Feature = function (title) {
      var suite = Suite.create(suites[0], title);
      suite.file = file;
      suite.timeout(0);
      suite.beforeEach('codeceptjs.before', scenario.setup);
      suite.afterEach('finialize codeceptjs', scenario.teardown);
      suites.unshift(suite);
      return suite;
    };

    context.Background = context.Before = function (fn) {
      suites[0].beforeEach('Before', scenario.injected(fn));
    };

    context.After = function (fn) {
      suites[0].afterEach('After', scenario.injected(fn));
    };

    /**
     * Describe a specification or test-case
     * with the given `title` and callback `fn`
     * acting as a thunk.
     */
    context.Scenario = function (title, fn) {
      var suite = suites[0];
      if (suite.pending) {
        fn = null;
      }
      var test = new Test(title, fn);
      test.file = file;
      test.async = false;
      test.timeout(0);
      suite.addTest(scenario.test(test));
      return test;
    };

    /**
     * Exclusive test-case.
     */
    context.Scenario.only = function (title, fn) {
      var test = context.Scenario(title, fn);
      var reString = '^' + escapeRe(test.fullTitle()) + '$';
      mocha.grep(new RegExp(reString));
    };

    /**
     * Pending test case.
     */
    context.xScenario = context.Scenario.skip = function (title) {
      context.Scenario(title);
    };
  });
};
