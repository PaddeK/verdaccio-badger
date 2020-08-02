'use strict';

const
    {describe, test, expect, beforeAll, beforeEach, afterEach, afterAll} = require('@jest/globals'),
    {badgen} = require('badgen'),
    importFresh = require('import-fresh'),
    Cache = require('./../src/Cache'),
    Utils = require('./../src/Utils');

jest.mock('badgen');
jest.mock('import-fresh');
jest.mock('./../src/Cache');

describe('validateConfig', () => {
    test('should remove invalid values', () => {
        const tests = [
            ['not a object', {}],
            [{enabled: 'invalid', endpoint: false, cache: false}, {}],
            [{enabled: true, endpoint: false, cache: false}, {enabled: true}],
            [{enabled: false, endpoint: false, cache: false}, {enabled: false}],
            [{enabled: 'invalid', endpoint: 'string', cache: false}, {endpoint: 'string'}],
            [{enabled: 'invalid', endpoint: false, cache: 'string'}, {cache: 'string'}],
            [{badges: {a: 'invalid'}, unknown: true}, {}],
            [{badges: {a: {name: false}}}, {}],
            [{badges: {a: {name: 'string'}}}, {}],
            [{badges: {a: {name: 'badge.svg'}}}, {badges: {a: {name: 'badge.svg'}}}],
            [{badges: {a: {name: 'badge.svg'}, b: false}}, {badges: {a: {name: 'badge.svg'}}}],
            [{badges: {a: {name: 'badge.svg'}, b: {name: true}}}, {badges: {a: {name: 'badge.svg'}}}],
            [{badges: {a: {name: 'a.svg'}, b: {name: 'b.svg'}}}, {badges: {a: {name: 'a.svg'}, b: {name: 'b.svg'}}}],
            [{badges: {a: {name: 'a.svg', useCache: 'str'}}}, {}],
            [{badges: {a: {name: 'a.svg', useCache: false}}}, {badges: {a: {name: 'a.svg', useCache: false}}}],
            [{badges: {a: {name: 'a.svg', useCache: false, unknown: true}}}, {}],
            [{badges: {a: {name: 'a.svg', useCache: false, options: true}}}, {}],
            [{badges: {a: {name: 'a.svg', options: {foo: 1}}}}, {badges: {a: {name: 'a.svg', options: {foo: 1}}}}]
        ]

        tests.forEach(t => expect(Utils.validateConfig(t[0])).toEqual(t[1]));
    });
});

describe('getPluginName', () => {
    test('should return package name of badge plugin', () => {
        const tests = [
            ['test', 'verdaccio-badger-test'],
            ['@scope/test', '@scope/test'],
            ['verdaccio-badger-test', 'verdaccio-badger-test'],
            ['@scope/verdaccio-badger-test', '@scope/verdaccio-badger-test'],
            ['', ''],
            [' ', ''],
            [undefined, ''],
            [null, ''],
            [true, ''],
        ];

        tests.forEach(t => expect(Utils.getPluginName(t[0])).toEqual(t[1]));
    });
});

describe('getPackage', () => {
    test('should resolve package metadata if package is valid and found', async () => {
        const
            mockMetadata = {
                name: 'test',
                versions: {'1.0.0': 'somedata'},
                time: {lastUpdate: new Date(null).toISOString()},
                'dist-tags': {latest: {some: 'data'}},
                moreData: true
            },
            MockStorage = {getPackage: jest.fn(({callback}) => callback(null, mockMetadata))};

        await expect(Utils.getPackage(MockStorage, 'test-module')).resolves.toMatchObject({
            name: 'test',
            versions: {'1.0.0': 'somedata'},
            time: {lastUpdate: new Date(null).toISOString()},
            'dist-tags': {latest: {some: 'data'}}
        });
        expect(MockStorage.getPackage).toHaveBeenCalledTimes(1);
        expect(MockStorage.getPackage).toHaveBeenCalledWith(expect.objectContaining({
            name: 'test-module',
            callback: expect.any(Function)
        }));
    });

    test('should reject if package is invalid or not found', async () => {
        const
            mockError = new Error('Not found'),
            MockStorage = {getPackage: jest.fn(({callback}) => callback(mockError))};

        await expect(Utils.getPackage(MockStorage, 'test-module')).rejects.toBe(mockError);
        expect(MockStorage.getPackage).toHaveBeenCalledTimes(1);
        expect(MockStorage.getPackage).toHaveBeenCalledWith(expect.objectContaining({
            name: 'test-module',
            callback: expect.any(Function)
        }));
    });
});

describe('tryCatch', () => {
    test('should return true if given function does not throw', () => {
        const mockFn = jest.fn();

        expect(Utils.tryCatch(mockFn)).toBe(true);
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith();
    });

    test('should return false if given function does throw', () => {
        const mockFn = jest.fn(() => {throw new Error('throwing')});

        expect(Utils.tryCatch(mockFn)).toBe(false);
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith();
    });
});

describe('errorBadge', () => {
    afterEach(() => {
        badgen.mockReset();
    });

    test('should return error badge svg', () => {
        badgen.mockImplementation(({status}) => status);

        expect(Utils.errorBadge('test-plugin')).toBe('test-plugin');
        expect(badgen).toHaveBeenCalledTimes(1);
        expect(badgen).toHaveBeenCalledWith({
            label: 'error',
            labelColor: 'red',
            status: 'test-plugin',
            color: 555,
            style: 'flat',
            scale: 1
        });
    });
});

describe('getSVG', () => {
    const
        errorBadgeSpy = jest.spyOn(Utils, 'errorBadge'),
        mockBadgeFn = jest.fn(),
        metaData = {some: 'metadata'},
        cache = new Cache({}, {});

    beforeAll(() => {
        importFresh.mockReturnValue(mockBadgeFn);
    });
    afterAll(() => {
        importFresh.mockRestore();
        errorBadgeSpy.mockRestore();
    });
    beforeEach(() => {
        cache.rm.mockReset();
        cache.get.mockReset();
        cache.put.mockReset();
        cache.has.mockReset();
        mockBadgeFn.mockReset();
        errorBadgeSpy.mockReset();
    });

    test('should remove previous cached data if useCache is false', async () => {
        cache.has.mockResolvedValue(false);

        await Utils.getSVG('test', {useCache: false}, 'verdaccio-badger-test', metaData, cache, 'cacheKey');
        expect(cache.rm).toHaveBeenNthCalledWith(1, 'cacheKey');
    });

    test('should return previous cached data and return it if useCache is true', async () => {
        cache.has.mockResolvedValue(true);
        cache.get.mockResolvedValue('<svg/>');

        await expect(Utils.getSVG('test', {}, 'verdaccio-badger-test', metaData, cache, 'cacheKey'))
            .resolves.toBe('<svg/>');
        expect(cache.rm).not.toHaveBeenCalled();
        expect(cache.has).toHaveBeenNthCalledWith(1, 'cacheKey');
        expect(cache.get).toHaveBeenNthCalledWith(1, 'cacheKey');
        expect(mockBadgeFn).not.toHaveBeenCalled();
        expect(cache.put).not.toHaveBeenCalled();
        expect(errorBadgeSpy).not.toHaveBeenCalled();
    });

    test('should call badge function if svg is not cached', async () => {
        cache.has.mockResolvedValue(false);
        mockBadgeFn.mockResolvedValue('<svg/>');
        cache.put.mockResolvedValue('<svg/>');

        await expect(Utils.getSVG('test', {}, 'verdaccio-badger-test', metaData, cache, 'cacheKey'))
            .resolves.toBe('<svg/>');
        expect(cache.rm).not.toHaveBeenCalled();
        expect(cache.has).toHaveBeenNthCalledWith(1, 'cacheKey');
        expect(cache.get).not.toHaveBeenCalled();
        expect(mockBadgeFn).toHaveBeenNthCalledWith(1, {some: 'metadata'}, {}, badgen);
        expect(cache.put).toHaveBeenNthCalledWith(1, 'cacheKey', '<svg/>');
        expect(errorBadgeSpy).not.toHaveBeenCalled();
    });

    test('should not return cached svg if useCache is false', async () => {
        cache.has.mockResolvedValue(false);
        mockBadgeFn.mockResolvedValue('<svg/>');

        await expect(Utils.getSVG('test', {useCache: false}, 'verdaccio-badger-test', metaData, cache, 'cacheKey'))
            .resolves.toBe('<svg/>');
        expect(cache.rm).toHaveBeenNthCalledWith(1, 'cacheKey');
        expect(cache.has).toHaveBeenNthCalledWith(1, 'cacheKey');
        expect(cache.get).not.toHaveBeenCalled();
        expect(mockBadgeFn).toHaveBeenNthCalledWith(1, {some: 'metadata'}, {}, badgen);
        expect(cache.put).not.toHaveBeenCalled();
        expect(errorBadgeSpy).not.toHaveBeenCalled();
    });

    test('should return errorBadge svg if badge function does not return valid svg', async () => {
        cache.has.mockResolvedValue(false);
        mockBadgeFn.mockResolvedValue('not svg');
        errorBadgeSpy.mockReturnValue('<svg>error</svg>');

        await expect(Utils.getSVG('test', {options: {foo: 1}}, 'verdaccio-badger-test', metaData, cache, 'cacheKey'))
            .resolves.toBe('<svg>error</svg>');
        expect(cache.rm).not.toHaveBeenCalled();
        expect(cache.has).toHaveBeenNthCalledWith(1, 'cacheKey');
        expect(cache.get).not.toHaveBeenCalled();
        expect(mockBadgeFn).toHaveBeenNthCalledWith(1, {some: 'metadata'}, {foo: 1}, badgen);
        expect(cache.put).not.toHaveBeenCalled();
        expect(errorBadgeSpy).toHaveBeenNthCalledWith(1, 'test');
    });
});