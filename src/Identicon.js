/* jshint undef: true, unused: true, browser: true, quotmark: single, curly: true */
/* global Ext */

/**
 * Based on Identicon.js v1.0
 * http://github.com/stewartlord/identicon.js
 *
 * Adapted to ExtJS class by Chris Alfano <chris@jarv.us>
 */

Ext.define('Jarvus.util.Identicon', (function() {

    var rectangle = function(x, y, w, h, color, image) {
            var i, j;
            for (i = x; i < x + w; i++) {
                for (j = y; j < y + h; j++) {
                    image.buffer[image.index(i, j)] = color;
                }
            }
        },
        hsl2rgb = function(h, s, b){
            h *= 6;
            s = [
                b += s *= b < 0.5 ? b : 1 - b,
                b - h % 1 * s * 2,
                b -= s *= 2,
                b,
                b + h % 1 * s,
                b + s
            ];

            return[
                s[ ~~h    % 6 ],  // red
                s[ (h|16) % 6 ],  // green
                s[ (h|8)  % 6 ]   // blue
            ];
        };

    return {
        singleton: true,
        requires: [
            'Jarvus.util.PNGlib'
        ],

        render: function(hash, size, margin) {
            size = size || 64;
            margin = Math.floor(size * (margin || 0.08));

            var cell    = Math.floor((size - (margin * 2)) / 5),
                image   = Ext.create('Jarvus.util.PNGlib', size, size, 256),

            // light-grey background
                bg      = image.color(240, 240, 240),

            // foreground is last 7 chars as hue at 50% saturation, 70% brightness
                rgb     = hsl2rgb(parseInt(hash.substr(-7), 16) / 0xfffffff, 0.5, 0.7),
                fg      = image.color(rgb[0] * 255, rgb[1] * 255, rgb[2] * 255),

                i, color;

            // the first 15 characters of the hash control the pixels (even/odd)
            // they are drawn down the middle first, then mirrored outwards
            for (i = 0; i < 15; i++) {
                color = parseInt(hash.charAt(i), 16) % 2 ? bg : fg;
                if (i < 5) {
                    rectangle(2 * cell + margin, i * cell + margin, cell, cell, color, image);
                } else if (i < 10) {
                    rectangle(1 * cell + margin, (i - 5) * cell + margin, cell, cell, color, image);
                    rectangle(3 * cell + margin, (i - 5) * cell + margin, cell, cell, color, image);
                } else if (i < 15) {
                    rectangle(0 * cell + margin, (i - 10) * cell + margin, cell, cell, color, image);
                    rectangle(4 * cell + margin, (i - 10) * cell + margin, cell, cell, color, image);
                }
            }

            return image;
        },

        renderToString: function() {
            return this.render.apply(this, arguments).getBase64();
        }
    };
})());