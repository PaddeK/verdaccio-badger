'use strict';

const
    {describe, test, expect, beforeEach, afterEach, afterAll} = require('@jest/globals'),
    resolveGlobal = require('resolve-global'),
    {Express} = require('jest-express/lib/express'),
    {Request} = require('jest-express/lib/request'),
    {Response} = require('jest-express/lib/response'),
    Badger = require('./../src/Badger'),
    Cache = require('./../src/Cache'),
    Utils = require('./../src/Utils');

jest.mock('resolve-global');
jest.mock('./../src/Cache');

describe('Badger creation', () => {
    const validateConfigSpy = jest.spyOn(Utils, 'validateConfig');

    afterAll(() => {
         validateConfigSpy.mockRestore();
    });
    afterEach(() => {
        Cache.mockReset();
        validateConfigSpy.mockReset();
    });

    test('should create a cache instance', () => {
        const badger = new Badger({}, {});

        expect(badger.cache).toBeInstanceOf(Cache);
        expect(Cache).toHaveBeenNthCalledWith(1, expect.any(Object), {});
    });

    test('should verify config and merge with defaults', () => {
        const badger = new Badger({}, {});

        expect(Utils.validateConfig).toHaveBeenNthCalledWith(1, {});
        expect(badger.enabled).toBe(Badger.Defaults.enabled);
        expect(badger.endpoint).toBe(Badger.Defaults.endpoint);
        expect(badger.badges).toEqual([]);
        expect(Cache).toHaveBeenNthCalledWith(1, Badger.Defaults, {});
    });
});

describe('register middleware', () => {
    let app;

    beforeEach(() => {
        app = new Express();
    });
    afterEach(() => {
        app.resetMocked();
    });

    test('should return immediately if not enabled', () => {
        const badger = new Badger({enabled: false}, {});

        expect(badger.register_middlewares(app, {}, {})).toBeUndefined();
        expect(app.get).not.toHaveBeenCalled();
    });

    test('should add a get route to express app if enabled', () => {
        const
            expectedPath = '/-/route/:scope?/:name/:svg',
            badger = new Badger({enabled: true, endpoint: '/-/route/'}, {}),
            endpointSpy = jest.spyOn(badger, 'badgeEndpoint');

        endpointSpy.mockImplementation(() => {});
        badger.register_middlewares(app, {}, {});

        expect(app.get).toHaveBeenNthCalledWith(1, expectedPath, expect.any(Function));
        expect(endpointSpy).toHaveBeenCalled();
    });
});

describe('badgeEndpoint', () => {
    let request, response;

    const
        getPackageSpy = jest.spyOn(Utils, 'getPackage'),
        getSVGSpy = jest.spyOn(Utils, 'getSVG'),
        errorBadgeSpy = jest.spyOn(Utils, 'errorBadge'),
        mockMetadata = {
            name: 'test',
            versions: {'1.0.0': 'somedata'},
            time: {lastUpdate: new Date(null).toISOString()},
            'dist-tags': {latest: '1.0.0'},
            moreData: true
        };

    afterAll(() => {
        getPackageSpy.mockRestore();
        getSVGSpy.mockRestore();
        errorBadgeSpy.mockRestore();
    });
    beforeEach(() => {
        request = new Request();
        response = new Response();
    });
    afterEach(() => {
        request.resetMocked();
        response.resetMocked();
        resolveGlobal.silent.mockReset();
        getPackageSpy.mockReset();
        getSVGSpy.mockReset();
        errorBadgeSpy.mockReset();
    });

    test('should return 404 File not found if badge is not found', async () => {
        const
            mockStorage = {getPackage: jest.fn()},
            next = jest.fn(),
            badger = new Badger({badges: {}});

        resolveGlobal.silent.mockReturnValue(undefined);

        request = new Request('/-/badger/test/test.svg');
        request.setParams({scope: undefined, name: 'test', svg: 'test.svg'});

        await badger.badgeEndpoint(mockStorage, request, response, next);

        expect(response.status).toHaveBeenNthCalledWith(1, 404);
        expect(next).toHaveBeenNthCalledWith(1, expect.stringContaining('File not found'));
    });

    test('should return svg if badge is found', async () => {
        const
            mockStorage = {getPackage: jest.fn()},
            badger = new Badger({badges: {test: {name: 'test.svg'}}});

        resolveGlobal.silent.mockReturnValue('badgePlugin');
        getPackageSpy.mockResolvedValue(mockMetadata);
        getSVGSpy.mockResolvedValue('<svg/>');

        request = new Request('/-/badger/test/test.svg');
        request.setParams({scope: undefined, name: 'test', svg: 'test.svg'});

        await badger.badgeEndpoint(mockStorage, request, response);

        expect(response.status).toHaveBeenNthCalledWith(1, 200);
        expect(response.set).toHaveBeenNthCalledWith(1, {'Content-Type': 'image/svg+xml'});
        expect(response.end).toHaveBeenNthCalledWith(1, '<svg/>');
    });

    test('should return error badge svg if error occurs', async () => {
        const
            mockStorage = {getPackage: jest.fn()},
            badger = new Badger({badges: {test: {name: 'test.svg'}}});

        resolveGlobal.silent.mockReturnValue('badgePlugin');
        getPackageSpy.mockResolvedValue(mockMetadata);
        getSVGSpy.mockRejectedValue();
        errorBadgeSpy.mockReturnValue('<svg>error</svg>');

        request = new Request('/-/badger/test/test.svg');
        request.setParams({scope: undefined, name: 'test', svg: 'test.svg'});

        await badger.badgeEndpoint(mockStorage, request, response);

        expect(response.status).toHaveBeenNthCalledWith(1, 200);
        expect(response.set).toHaveBeenNthCalledWith(1, {'Content-Type': 'image/svg+xml'});
        expect(response.end).toHaveBeenNthCalledWith(1, '<svg>error</svg>');
    });
});

