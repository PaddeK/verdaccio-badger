# verdaccio-badger
Verdaccio middleware plugin to serve svg badges

[![verdaccio-badger (latest)](https://img.shields.io/npm/v/verdaccio-badger/latest.svg)](https://www.npmjs.com/package/verdaccio-badger)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/node/v/verdaccio-badger/latest.svg)](https://www.npmjs.com/package/verdaccio-badger)

## Requirements

* verdaccio@4.x or higher

```
 npm install --global verdaccio-badger
```

## Usage

To enable the plugin you need to add following lines to your configuration file.  
```
middlewares:
  badger:
    # Enables the plugin - the only required config parameter
    enabled: true
    # path to directory to keep cached badges - to disable set to false or remove key
    cache: ./cache
    # base url path used to serve the badges
    endpoint: /-/badger/
    # badges to serve - default no badges are served
    badges:
      # minimal test badge
      '@paddek/verdaccio-badger-test':  # if package is not scoped test: would have sufficed
        # svg filename which renders this badge
        name: test.svg
        # whether to use caching for this badge or not (default: true, if cache for badger is enabled)
        useCache: false
        # options passed to badge
        options:
          prefix: v
```

## Badges

By itself verdaccio-badger does not serve any badges. Badges are additional plugins prefixed with `verdaccio-badger-`
which generate and return badges as SVG.

#### Installing and creating Badges
See [@paddek/verdaccio-badger-test](https://github.com/PaddeK/verdaccio-badger-test) badge.

## License

MIT (http://www.opensource.org/licenses/mit-license.php)