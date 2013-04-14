/**
 * roto - A no-nonsense build tool for Node.js projects.
 *
 * Copyright (c) 2012 DIY Co
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License. You may obtain a copy of the License at:
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * @author Brian Reavis <brian@thirdroute.com>
 */

var _         = require('underscore'),
    fs        = require('fs'),
    path      = require('path'),
    glob      = require('glob'),
    wrench    = require('wrench'),
    minimatch = require('minimatch'),
    colorize  = require('./colorize.js');

var roto = module.exports = (function() {
	var roto = {};

	var currentTarget = null;
	var taskTemplates = {};
	var atMargin = true;

	var console_dir   = console.dir;
	var console_log   = console.log;
	var console_error = console.error;
	var write_stdout  = process.stdout.write;
	var write_stderr  = process.stderr.write;

	var project = {
		name: 'Untitled Project',
		targets: {}
	};

	roto._project = project;
	roto.defaultTarget = 'all';
	roto.dirname = __dirname.replace(/\/lib\/?$/, '');
	roto.depth = 0;
	roto.options = {
		silent: false,
		profile: false,
		indent: true
	};

	/**
	 * Colorizes a string.
	 *
	 * @param {string} string
	 * @param {string} color
	 */
	roto.colorize = colorize;

	/**
	 * Turns byte count into a human-readable filesize.
	 *
	 * @param {number} size
	 * @returns {string}
	 */
	roto.formatFilesize = function(size) {
		if (size === null || typeof size === 'undefined') {
			return 'NaN';
		}
		var tiers = ['bytes', 'KB', 'MB', 'GB', 'TB'];
		var i = 0;
		while (size >= 1024) {
			size = size / 1024;
			i++;
		}
		return Math.round(size, 1) + ' ' + tiers[i];
	};

	/**
	 * Profile targets.
	 *
	 * If option is present `endProfile` will output the profile time.
	 */
	roto.startTime = 0;
	roto.endTime   = 0;
	roto.startProfile = function () {
		roto.startTime = new Date().getTime();
	};

	roto.endProfile = function () {
		roto.endTime = new Date().getTime();
		var total = ((roto.endTime - roto.startTime) / 1000).toFixed(2);

		if (roto.options.hasOwnProperty('profile')) {
			process.stdout.write('\n');
			process.stdout.write('Finished in ' + total + 's\n');
		}
	};

	/**
	 * Performs a glob search for files relative to the project root.
	 *
	 * @param  search  A path, or array of paths, to search for. Supports glob syntax.
	 * @param  ignore  A path, or array of paths, to ignore. Supports glob syntax.
	 */
	roto.findFiles = function(search, ignore) {
		var i, j, n;
		var globbed, doignore;
		var paths = [];

		search || (search = []);
		ignore || (ignore = []);
		if (typeof ignore === 'string') { ignore = [ignore]; }

		// search for matching paths
		if (typeof search === 'string') { search = [search]; }
		for (i = 0; i < search.length; i++) {
			globbed = glob.sync(search[i].replace(/^\//, ''));
			for (j = 0; j < globbed.length; j++) {
				paths.push(globbed[j]);
			}
		}

		// filter out duplicates
		paths = _.uniq(paths);

		// filter out ignored files
		for (i = paths.length - 1; i >= 0; i--) {
			for (j = 0; j < ignore.length; j++) {
				if (minimatch(paths[i], ignore[j].replace(/^\//, ''))) {
					paths.splice(i, 1);
					break;
				}
			}
		}

		return paths;
	};

	/**
	 * Writes a file. If the parent directory doesn't
	 * exist, it will be created.
	 *
	 * @param {string} destination
	 * @param {mixed} content
	 * @param {string} encoding
	 */
	roto.writeFile = function(destination, content, encoding) {
		try {
			fs.writeFileSync(destination, content, encoding);
		} catch (e) {
			var dirname = path.dirname(destination);
			if (!fs.existsSync(dirname)) {
				wrench.mkdirSyncRecursive(dirname);
				fs.writeFileSync(destination, content, encoding);
			} else {
				throw e;
			}
		}
	};

	/**
	 * Properly formats output and passes it to `write`,
	 * which should be a reference to process.stdout.write,
	 * process.stderr.write, etc.
	 *
	 * @param {function} write
	 * @param {string} str
	 */
	var write_console = (function() {
		return function(write, str) {
			if (typeof str === 'undefined' || roto.options.silent) return;

			str = (str + '').replace(/[\r]/g, '\r' + indent('', roto.depth));

			var i, n, suffix, str;
			var depth = roto.depth;
			var lines = str.split(/[\n\u000b\u000c\u0085\u2028\u2029]/);
			var last  = lines[lines.length - 1];

			for (i = 0, n = lines.length; i < n; i++) {
				suffix = (i === n - 1) ? '' : '\n';
				str = (i > 0 || atMargin) && (i < n - 1 || lines[i] !== '') ? indent(lines[i], depth) : lines[i];
				write(str + suffix);
			}

			atMargin = last === '';
		};
	})();

	/**
	 * Indents a string.
	 *
	 * @param {string} str
	 * @param {int} depth
	 * @returns {string}
	 */
	var indent = (function() {
		var tab = roto.colorize('░ ', 'gray');
		var tabs = {};
		return function(str, depth) {
			if (!roto.options.indent) return str;

			// indentation characters
			var prefix = tabs[depth];
			if (!prefix) {
				var buffer = [];
				for (var i = 0; i < depth; i++) {
					buffer.push(tab);
				}
				prefix = tabs[depth] = buffer.join('');
			}

			// prepend to string
			return prefix + str;
		};
	})();

	/**
	 * Invoked on process.stdin "data" event.
	 */
	var onStdInData = function() {
		atMargin = true;
	};

	/**
	 * Writes a notice to the console (stdout).
	 *
	 * @deprecated
	 * @param {string} str
	 */
	roto.notice = function(str) {
		write_console(_.bind(write_stdout, process.stdout), str);
	};

	/**
	 * Writes an error to the console (stderr).
	 *
	 * @deprecated
	 * @param {string} str
	 */
	roto.error = function(str) {
		write_console(_.bind(write_stderr, process.stderr), str);
	};

	/**
	 * Sets up a target for the current project.
	 *
	 * @param {string} name - Target name.
	 * @param {object} options - Additional target information.
	 * @param {function} setup - Target execution function.
	 */
	roto.addTarget = function(name, options, setup) {
		if (typeof options === 'function') {
			setup   = options;
			options = null;
		}

		var target = project.targets[name] = {
			name    : name,
			options : options,
			tasks   : [],
			run     : function(options, callback) {
				// setup target
				var oldTarget = currentTarget;
				currentTarget = target;
				target.tasks  = [];
				setup(options);

				// execute target
				var i = 0;
				var iterator = function() {
					if (i === target.tasks.length) {
						callback();
						return;
					}
					target.tasks[i++](options, function(result) {
						if (result === false) callback(false);
						else iterator();
					});
				};
				iterator();

				currentTarget = oldTarget;
			}
		};
	};

	/**
	 * Adds a task to the current target.
	 * Call this from a target setup method.
	 *
	 * Usage:
	 *     roto.addTask('lint', {
	 *        files: 'something.js'});
	 *     });
	 *     roto.addTask(function(callback) {
	 *         console.log('Do something');
	 *         callback();
	 *     });
	 *
	 * @param  method       Callback, or name of the predefined task.
	 * @param  taskOptions  An object containing configuration info
	 *                      for the task when it executes.
	 */
	roto.addTask = function() {
		var target = currentTarget;
		var taskOptionsData = arguments.length > 1 ? arguments[1] : null;
		var taskOptions;

		// allow for options to be computed at task execution time
		if (typeof taskOptionsData === 'function') {
			taskOptions = taskOptionsData;
		} else {
			taskOptions = function() {
				return taskOptionsData;
			};
		}

		// sanity check
		if (!target) {
			console.error(colorize('ERROR:', 'red') + ' roto.addTask() can only be called within the roto.addTarget() callback.');
			return false;
		}

		// add method to task list of the current target
		if (typeof arguments[0] === 'function') {
			var fn = arguments[0];
			target.tasks.push(function(options, callback) {
				fn(callback, taskOptions(), target, options);
			});
		} else {
			if (arguments[0].indexOf('target:') === 0) {
				var targetName = arguments[0].substring(7).replace(/^\s\s*/,'');
				target.tasks.push(function(options, callback) {
					roto.executeTarget(targetName, _.extend({}, options, taskOptions()), callback);
				});
			} else {
				var taskName = arguments[0];
				target.tasks.push(function(options, callback) {
					if (typeof taskTemplates[taskName] !== 'function') {
						console.error(colorize('ERROR:', 'red') + ' "' + taskName + '" task not defined.');
						callback(false);
					} else {
						taskTemplates[taskName](callback, taskOptions(), target, options);
					}
				});
			}
		}
	};

	/**
	 * Defines a task so that it can be invoked later,
	 * one or more times.
	 *
	 * @param  taskName  Name of the task.
	 * @param  callback  Function that performs the task.
	 */
	roto.defineTask = function(taskName, callback) {
		taskTemplates[taskName] = callback;
	};

	/**
	 * Executes a single target.
	 *
	 * @param  targetName  The name of the target.
	 * @param  options     Configuration options to pass to the target.
	 * @param  callback    Invoked upon completion.
	 */
	roto.executeTarget = function(targetName, options, callback) {
		var target = project.targets[targetName];

		console.log(colorize('▾ target:' + target.name, 'blue'));
		roto.depth++;
		target.run(options, function() {
			roto.depth--;
			return callback.apply(null, arguments);
		});
	};

	/**
	 * Invoked when a build begins.
	 */
	roto.onBuildStart = function() {
		console.log   = function() { roto.notice(Array.prototype.join.apply(arguments, [' ']) + '\n'); };
		console.error = function() { roto.error(Array.prototype.join.apply(arguments, [' ']) + '\n'); };
		console.dir   = function() {
			try { roto.notice(Array.prototype.join.apply(_.map(arguments, JSON.stringify), [' ']) + '\n'); }
			catch (e) { console.log.apply(this, arguments); }
		};
		process.stdout.write = roto.notice;
		process.stderr.write = roto.error;
		process.stdin.on('data', onStdInData);
	};

	/**
	 * Teardown method invoked after a build completes.
	 */
	roto.onBuildEnd = function() {
		roto.endProfile();
		console.log   = console_log;
		console.error = console_error;
		console.dir   = console_dir;
		process.stdout.write = write_stdout;
		process.stderr.write = write_stderr;
		process.stdin.off('data', onStdInData);
	};

	/**
	 * Build it!
	 *
	 * @param  targetName  The name of the target you want to build.
	 *                     Use an array of target names to build multiple
	 *                     targets at once. To build all targets, use "all".
	 * @param  options     An object containing global options, provided
	 *                     to all tasks.
	 * @param  callback    Callback. Invoked upon build completion.
	 */
	roto.run = function(targetName, options, callback) {
		var i, oldGlobals;

		// setup
		atMargin = true;
		targetName = targetName || roto.defaultTarget;
		options = options || {};
		roto.depth = 0;
		roto.onBuildStart();

		// determine selected targets
		var selectedTargets = [];
		if (typeof targetName === 'string') {
			targetName = targetName.toLowerCase();
			if (targetName === 'all') {
				for (var key in project.targets) {
					if (project.targets.hasOwnProperty(key)) {
						selectedTargets.push(key);
					}
				}
			} else {
				selectedTargets.push(targetName);
			}
		} else if (Array.isArray(targetName)) {
			for (i = 0; i < targetName.length; i++) {
				selectedTargets.push(targetName[i]);
			}
		}

		// check that all targets exist
		if (!selectedTargets.length) {
			console.error(colorize('ERROR:', 'red') + ' No matching build targets were found.');
			console.error('       Run with ' + colorize('--help', 'white') + ' to see available targets.');
			return false;
		}

		for (i = 0; i < selectedTargets.length; i++) {
			if (!project.targets.hasOwnProperty(selectedTargets[i])) {
				console.error(colorize('ERROR:', 'red') + ' "' + selectedTargets[i] + '" target not found.');
				return false;
			}
		}

		// build selected targets
		var executeTargets = (function() {
			var i = 0;
			var iterator = function(result) {
				if (result === false || i === selectedTargets.length) {
					roto.onBuildEnd();
					if (typeof callback === 'function') {
						callback(result !== false);
					}
					return;
				}

				roto.executeTarget(selectedTargets[i++], options, iterator);
			};
			roto.startProfile();
			iterator();
		})();
	};

	return roto;
})();

require(__dirname + '/tasks/concat.js')(roto);
require(__dirname + '/tasks/handlebars.js')(roto);
require(__dirname + '/tasks/lint.js')(roto);
require(__dirname + '/tasks/s3.js')(roto);
require(__dirname + '/tasks/uglify.js')(roto);
require(__dirname + '/tasks/mocha.js')(roto);
require(__dirname + '/tasks/less.js')(roto);
require(__dirname + '/tasks/png.js')(roto);
require(__dirname + '/tasks/dir.js')(roto);
require(__dirname + '/tasks/template.js')(roto);