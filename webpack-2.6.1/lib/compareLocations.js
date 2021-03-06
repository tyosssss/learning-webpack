/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

/**
 * 比较位置
 * @param {String|Object} a 
 * @param {String|Object} b
 * @returns {Number} -1 -- a < b; 1 -- a >b; 0 -- a = b 
 */
module.exports = function compareLocations(a, b) {
	if(typeof a === "string") {
		if(typeof b === "string") {
			if(a < b) return -1;
			if(a > b) return 1;
			return 0;
		} else if(typeof b === "object") {
			return 1;
		} else {
			return 0;
		}
	} else if(typeof a === "object") {
		if(typeof b === "string") {
			return -1;
		} else if(typeof b === "object") {
			if(a.start && b.start) {
				const ap = a.start;
				const bp = b.start;
				if(ap.line < bp.line) return -1;
				if(ap.line > bp.line) return 1;
				if(ap.column < bp.column) return -1;
				if(ap.column > bp.column) return 1;
			}
			if(a.index < b.index) return -1;
			if(a.index > b.index) return 1;
			return 0;
		} else {
			return 0;
		}
	}
};
