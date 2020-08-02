'use strict';

const
    ONE_HOUR = 60 * 60 * 1000,
    MODE = 0o0600,
    {mkdirSync} = require('fs'),
    {dirname, resolve} = require('path'),
    cacache = require('cacache'),
    Utils = require('./Utils');

class Cache
{
    /**
     * @param {{cache: any}} config
     * @param {{config: {self_path: string}}|object} options
     */
    constructor (config, options)
    {
        this.path = null;
        this.lastRun = 0;
        this.useCache = false;

        if (typeof config.cache === 'string' && options.config && options.config.self_path) {
            this.path = resolve(dirname(options.config.self_path), config.cache);
            this.useCache = Utils.tryCatch(() => mkdirSync(this.path, {mode: MODE, recursive: true}));
        }
    }

    /**
     * @param {string} scope
     * @param {string} name
     * @param {string} version
     * @param {string} badge
     * @return {string}
     */
    static genKey (scope, name, version, badge)
    {
        return `${scope ? scope : 'global'}-${name}-${version}-${badge}`;
    }

    /**
     * @param {string} key
     * @return {Promise<boolean>}
     */
    async has (key)
    {
        return this.useCache ? !!(await cacache.get.info(this.path, key)) : false;
    }

    /**
     * @param {string} key
     * @return {Promise<string|null>}
     */
    async get (key)
    {
        if (this.useCache) {
            const {data} = await cacache.get(this.path, key);
            return data.toString();
        }
        return null;
    }

    /**
     * @param key
     * @param {Buffer|string} data
     * @return {Promise}
     */
    async put (key, data)
    {
        this.useCache && await cacache.put(this.path, key, data);
        return data;
    }

    /**
     * @return {Promise}
     */
    async clear ()
    {
        this.useCache && await cacache.rm.all(this.path);
    }

    /**
     * @param {string} key
     * @return {Promise}
     */
    async rm (key)
    {
        if (!this.useCache) {
            return;
        }

        await cacache.rm.entry(this.path, key);

        (Date.now() - this.lastRun > ONE_HOUR) && await this.verify();
    }

    /**
     * @return {Promise}
     */
    async verify ()
    {
        if (!this.useCache) {
            return null;
        }

        const
            result = await cacache.verify(this.path),
            date = await cacache.verify.lastRun(this.path);

        this.lastRun = date.valueOf();

        return result;
    }
}

module.exports = Cache;
