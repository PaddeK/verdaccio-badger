'use strict';

const
    PackageJson = require('./../package.json'),
    importFresh = require('import-fresh'),
    isSvg = require('is-svg'),
    {badgen} = require('badgen'),
    validatePackage = require('validate-npm-package-name'),
    FilenameRgx = /^[0-9a-z_-]{1,28}\.svg$/i;

class Utils
{
    /**
     * @param {*} config
     * @return {object}
     */
    static validateConfig (config)
    {
        config = typeof config === 'object' ? config : {};

        Object.keys(config).forEach(k => !['badges', 'endpoint', 'cache', 'enabled'].includes(k) && delete config[k]);

        typeof config.enabled !== 'boolean' && delete config.enabled;
        typeof config.endpoint !== 'string' && delete config.endpoint;
        typeof config.cache !== 'string' && delete config.cache;
        config.badges = Object.fromEntries(Object.entries(config.badges || {}).filter(([, v]) => [
            typeof v === 'object',
            Object.keys(v).every(k => ['name', 'useCache', 'options'].includes(k)),
            typeof v.name === 'string',
            FilenameRgx.test(v.name),
            v.useCache === undefined || typeof v.useCache === 'boolean',
            v.options === undefined || typeof v.options === 'object',
            Object.keys(v).length && Object.keys(v).length <= 3
        ].every(Boolean)));
        Object.keys(config.badges).length === 0 && delete config.badges;

        return config;
    }

    /**
     * @param {string} badge
     * @return {string}
     */
    static getPluginName (badge)
    {
        if (typeof badge !== 'string' || !validatePackage(badge).validForNewPackages) {
            return '';
        }

        const {scope, name} = badge.match(/^(?:(?<scope>@[^@/ ]+)\/)?(?<name>[^@/ ]+)$/i).groups;

        return scope || (name && name.startsWith(PackageJson.name)) ? badge : [PackageJson.name, badge].join('-');
    }

    /**
     * @param {{getPackage: function}} storage
     * @param {string} module
     * @return {Promise<{name: string, versions: object, tags: object, time: object}>}
     */
    static getPackage (storage, module)
    {
        return new Promise((ok, nok) => {
            storage.getPackage({name: module, callback: (err, metaData) => {
                if (err) {
                    return nok(err);
                }

                const {name, versions, time, 'dist-tags': tags} = metaData;

                ok({name, versions, time, 'dist-tags': tags});
            }});
        });
    }

    /**
     * @param {string} badge
     * @param {{options?: object, useCache?: boolean}} badgeConfig
     * @param {string} badgePlugin
     * @param {object} metaData
     * @param {Cache} cache
     * @param {string} cacheKey
     * @return {Promise<string>}
     */
    static async getSVG (badge, badgeConfig, badgePlugin, metaData, cache, cacheKey)
    {
        badgeConfig.useCache = badgeConfig.useCache === undefined ? true : !!badgeConfig.useCache;
        badgeConfig.options = badgeConfig.options || {};

        const {options, useCache} = badgeConfig;

        if (!useCache) {
            await cache.rm(cacheKey);
        }

        if (await cache.has(cacheKey)) {
            return await cache.get(cacheKey);
        }

        const
            badgeFn = importFresh(badgePlugin),
            svg = await badgeFn(metaData, options, badgen);

        return isSvg(svg) ? (useCache ? await cache.put(cacheKey, svg) : svg) : Utils.errorBadge(badge);
    }

    /**
     * @param {string} plugin
     * @return {string}
     */
    static errorBadge (plugin)
    {
        return badgen({label: 'error', labelColor: 'red', status: plugin, color: 555, style: 'flat', scale: 1});
    }

    /**
     * @param {function} callback
     * @return {boolean}
     */
    static tryCatch (callback)
    {
        try {
            callback();
            return true;
        } catch (err) {
            return false;
        }
    }
}

module.exports = Utils;