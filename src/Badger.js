'use strict';

const
    Defaults = {
        enabled: true,
        endpoint: '/-/badger/',
        cache: false,
        badges: {}
    },
    {posix: {join}} = require('path'),
    resolveGlobal = require('resolve-global'),
    Cache = require('./Cache'),
    Utils = require('./Utils'),
    BaseRoute = '/:scope?/:name/:svg',
    SvgHeader = {'Content-Type': 'image/svg+xml'};

class Badger
{
    static get Defaults ()
    {
        return Defaults;
    }

    constructor (config, options)
    {
        config = Object.assign({}, Defaults, Utils.validateConfig(config));

        this.enabled = config.enabled;
        this.endpoint = config.endpoint;
        this.badges = Object.entries(config.badges);
        this.cache = new Cache(config, options);
    }

    /**
     * @param {object} app
     * @param {object} auth
     * @param {{getPackage: function}} storage
     */
    register_middlewares (app, auth, storage)
    {
        if (!this.enabled) {
            return;
        }

        app.get(join(this.endpoint, BaseRoute), this.badgeEndpoint.bind(this, storage));
    }

    async badgeEndpoint (storage, req, res, next)
    {
        const
            {scope, name, svg} = req.params,
            badge = this.badges.find(([, {name}]) => name === svg),
            [badgeName, badgeConfig] = badge || [undefined, undefined],
            badgePlugin = resolveGlobal.silent(Utils.getPluginName(badgeName));

        if (badge === undefined || badgePlugin === undefined) {
            res.status(404);
            return next(JSON.stringify({error: 'File not found'}, null, 2));
        }

        res.status(200).set(SvgHeader);

        try {
            const
                module = [scope, name].filter(Boolean).join('/'),
                metaData = await Utils.getPackage(storage, module),
                {'dist-tags': {latest: version}} = metaData,
                cacheKey = Cache.genKey(scope, name, version, badgeName);

            res.end(await Utils.getSVG(badgeName, badgeConfig, badgePlugin, metaData, this.cache, cacheKey));
        } catch (err) {
            res.end(Utils.errorBadge(badgeName));
        }
    }
}

module.exports = Badger;