'use strict';

const
    {sep} = require('path'),
    {describe, test, expect, beforeAll, afterEach, afterAll} = require('@jest/globals'),
    {advanceBy, clear} = require('jest-date-mock'),
    cacache = require('cacache'),
    fs = require('fs'),
    Cache = require('./../src/Cache');

jest.mock('cacache');
jest.mock('fs');

beforeAll(() => {
    fs.mkdirSync.mockImplementation(() => {}); // prevent dir creation
});
afterAll(() => {
    fs.mkdirSync.mockReset();
});

describe('Cache creation', () => {
    test('should be disabled without cache configuration', () => {
        const cache = new Cache({}, {config: {self_path: __filename}});

        expect(cache.path).toBeNull();
        expect(cache.lastRun).toBe(0);
        expect(cache.useCache).toBe(false);
    });

    test('should be disabled without self_path from options', () => {
        const cache = new Cache({cache: './cache'}, {});

        expect(cache.path).toBeNull();
        expect(cache.lastRun).toBe(0);
        expect(cache.useCache).toBe(false);
    });

    test('should be enabled with self_path from options and configured cache path', () => {
        const cache = new Cache({cache: './cache'}, {config: {self_path: __filename}});

        expect(cache.path).toBe(__dirname + sep + 'cache');
        expect(cache.lastRun).toBe(0);
        expect(cache.useCache).toBe(true);
    });
});

describe('genKey', () => {
    test('should generate valid cacheKeys', () => {
        const
            inputs = [
                [],
                ['scope'],
                ['scope', 'name'],
                ['scope', 'name', 'version'],
                ['scope', 'name', 'version', 'badge'],
                [undefined, 'name', 'version', 'badge'],
            ],
            expected = [
                'global-undefined-undefined-undefined',
                'scope-undefined-undefined-undefined',
                'scope-name-undefined-undefined',
                'scope-name-version-undefined',
                'scope-name-version-badge',
                'global-name-version-badge'
            ]
        inputs.forEach((input, index) => expect(Cache.genKey.apply(Cache, input)).toBe(expected[index]));
    });
});

describe('has', () => {
    afterEach(() => {
        cacache.get.info.mockReset();
    });

    test('should always return false if useCache is false', async () => {
        const cache = new Cache({cache: false}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(false);
        expect(await cache.has('foo')).toBe(false);
        cacache.get.info.mockResolvedValue('bar');
        expect(await cache.has('foo')).toBe(false);
    });

    test('should return true if key exists false otherwise', async () => {
        const cache = new Cache({cache: './cache'}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(true);
        expect(await cache.has('foo')).toBe(false);
        cacache.get.info.mockResolvedValue('bar');
        expect(await cache.has('foo')).toBe(true);
    });
});

describe('get', () => {
    afterEach(() => {
        cacache.get.mockReset();
    });

    test('should return null if useCache is false', async () => {
        const cache = new Cache({cache: false}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(false);
        expect(await cache.get('foo')).toBeNull();
        expect(cacache.get).toHaveBeenCalledTimes(0);
    });

    test('should return cache entry if useCache is true', async () => {
        const
            MockEntry = {data: Buffer.from('bar', 'utf8')},
            cache = new Cache({cache: './cache'}, {config: {self_path: __filename}});

        cacache.get.mockResolvedValue(MockEntry);

        expect(cache.useCache).toBe(true);
        expect(await cache.get('foo')).toBe('bar');
        expect(cacache.get).toHaveBeenCalledTimes(1);
        expect(cacache.get).toHaveBeenNthCalledWith(1, expect.any(String), 'foo');
    });
});

describe('put', () => {
    afterEach(() => {
        cacache.put.mockReset();
    });

    test('should always return data if useCache is false', async () => {
        const cache = new Cache({cache: false}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(false);
        expect(await cache.put('foo', 'bar')).toBe('bar');
        expect(cacache.put).toHaveBeenCalledTimes(0);
    });

    test('should store data in cache and return data', async () => {
        const cache = new Cache({cache: './cache'}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(true);
        expect(await cache.put('foo', 'bar')).toBe('bar');
        expect(cacache.put).toHaveBeenCalledTimes(1);
    });
});

describe('clear', () => {
    afterEach(() => {
        cacache.rm.all.mockReset();
    });

    test('should do nothing if useCache is false', async () => {
        const cache = new Cache({cache: false}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(false);
        await cache.clear();
        expect(cacache.rm.all).toHaveBeenCalledTimes(0);
    });

    test('should remove all cache entries if useCache is true', async () => {
        const cache = new Cache({cache: './cache'}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(true);
        await cache.clear();
        expect(cacache.rm.all).toHaveBeenCalledTimes(1);
    });
});

describe('rm', () => {
    afterEach(() => {
        cacache.rm.entry.mockReset();
        clear();
    });

    test('should do nothing if useCache is false', async () => {
        const cache = new Cache({cache: false}, {config: {self_path: __filename}});

        cache.verify = jest.fn();

        expect(cache.useCache).toBe(false);
        await cache.rm('foo');
        expect(cacache.rm.entry).toHaveBeenCalledTimes(0);
        expect(cache.verify).toHaveBeenCalledTimes(0);
    });

    test('should remove key from cache if useCache is true', async () => {
        const cache = new Cache({cache: './cache'}, {config: {self_path: __filename}});

        cache.verify = jest.fn();

        expect(cache.useCache).toBe(true);
        await cache.rm('foo');
        expect(cacache.rm.entry).toHaveBeenCalledTimes(1);
        expect(cacache.rm.entry).toHaveBeenNthCalledWith(1, expect.any(String), 'foo');
        expect(cache.verify).toHaveBeenCalledTimes(1);
    });

    test('should only call verify if lastRun is > 1h ago', async () => {
        const cache = new Cache({cache: './cache'}, {config: {self_path: __filename}});

        cache.lastRun = Date.now(); // set last run to now
        cache.verify = jest.fn();

        expect(cache.useCache).toBe(true);
        await cache.rm('foo');
        expect(cache.verify).toHaveBeenCalledTimes(0);

        advanceBy(60 * 60 * 1000 + 1);  // set time to >1h from lastRun

        await cache.rm('bar');
        expect(cache.verify).toHaveBeenCalledTimes(1);
    });
});

describe('verify', () => {
    afterEach(() => {
        cacache.verify.lastRun.mockReset();
        cacache.verify.mockReset();
    });

    test('should do nothing and return null if useCache is false', async () => {
        const cache = new Cache({cache: false}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(false);
        expect(cache.lastRun).toBe(0);

        expect(await cache.verify()).toBeNull();

        expect(cacache.verify).toHaveBeenCalledTimes(0);
        expect(cacache.verify.lastRun).toHaveBeenCalledTimes(0);
        expect(cache.lastRun).toBe(0);
    });

    test('should return verify stats and set lastRun date if useCache is true', async () => {
        const
            MockDate = new Date(),
            MockState = {some: 'stats'},
            cache = new Cache({cache: './cache'}, {config: {self_path: __filename}});

        expect(cache.useCache).toBe(true);
        expect(cache.lastRun).toBe(0);

        cacache.verify.mockResolvedValue(MockState);
        cacache.verify.lastRun.mockResolvedValue(MockDate);

        expect(await cache.verify()).toBe(MockState);

        expect(cacache.verify).toHaveBeenCalledTimes(1);
        expect(cacache.verify.lastRun).toHaveBeenCalledTimes(1);
        expect(cache.lastRun).toBe(MockDate.valueOf());
    });
});