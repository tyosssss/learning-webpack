/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

class Entrypoint {
	constructor(name) {
		this.name = name;
		this.chunks = [];
	}

	/**
	 * 向入口点中添加初始块
	 * @param {Chunk} chunk 块实例
	 */
	unshiftChunk(chunk) {
		this.chunks.unshift(chunk);

		chunk.entrypoints.push(this);
	}

	/**
	 * 插入一个块
	 * @param {Chunk} chunk 块实例
	 * @param {Number} before 插入位置
	 */
	insertChunk(chunk, before) {
		const idx = this.chunks.indexOf(before);

		if (idx >= 0) {
			this.chunks.splice(idx, 0, chunk);
		} else {
			throw new Error("before chunk not found");
		}

		chunk.entrypoints.push(this);
	}

	/**
	 * 获得入口点中的所有块的所有文件列表
	 */
	getFiles() {
		const files = [];

		for (let chunkIdx = 0; chunkIdx < this.chunks.length; chunkIdx++) {
			for (let fileIdx = 0; fileIdx < this.chunks[chunkIdx].files.length; fileIdx++) {
				if (files.indexOf(this.chunks[chunkIdx].files[fileIdx]) === -1) {
					files.push(this.chunks[chunkIdx].files[fileIdx]);
				}
			}
		}

		return files;
	}
}

module.exports = Entrypoint;
