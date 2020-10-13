var extend = require('xtend');
var methods = require('methods');
var request_1 = require('./request');
var response_1 = require('./response');
var plugins = require('./plugins/index');
var form_1 = require('./form');
var jar_1 = require('./jar');
function extendDefaults(defaults, options) {
    if (typeof options === 'string') {
        return extend(defaults, { url: options });
    }
    return extend(defaults, options);
}
function defaults(defaultsOptions) {
    var popsicle = function popsicle(options) {
        var opts = extendDefaults(defaultsOptions, options);
        if (typeof opts.url !== 'string') {
            throw new TypeError('No URL specified');
        }
        return new request_1.default(opts);
    };
    popsicle.Request = request_1.default;
    popsicle.Response = response_1.default;
    popsicle.plugins = plugins;
    popsicle.form = form_1.default;
    popsicle.jar = jar_1.default;
    popsicle.browser = !!process.browser;
    popsicle.defaults = function (options) {
        return defaults(extend(defaultsOptions, options));
    };
    methods.forEach(function (method) {
        ;
        popsicle[method] = function (options) {
            return popsicle(extendDefaults({ method: method }, options));
        };
    });
    return popsicle;
}
exports.defaults = defaults;
//# sourceMappingURL=common.js.map