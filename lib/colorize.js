/**
 * String Colorization
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

module.exports = function(str, color) {
	var options = {
		red     : '\033[31m',
		yellow  : '\033[33m',
		green   : '\033[32m',
        magenta : '\033[35m',
		white   : '\033[1;39m'
	};
	return options.hasOwnProperty(color) ? (options[color] + str + '\033[0;39m') : str;
};