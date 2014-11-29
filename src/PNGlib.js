/* jshint undef: true, unused: true, browser: true, quotmark: single, curly: true */
/* global Ext */

/**
 * Based on PNGlib v1.0
 * http://www.xarg.org/2010/03/generate-client-side-png-files-using-javascript/
 *
 * Adapted to ExtJS class by Chris Alfano <chris@jarv.us>
 */

Ext.define('Jarvus.util.PNGlib', (function() {

    // helper functions for that ctx
    var write = function(buffer, offs) {
            for (var i = 2; i < arguments.length; i++) {
                for (var j = 0; j < arguments[i].length; j++) {
                    buffer[offs++] = arguments[i].charAt(j);
                }
            }
        },
        byte2 = function(w) {
            return String.fromCharCode((w >> 8) & 255, w & 255);
        },
        byte4 = function(w) {
            return String.fromCharCode((w >> 24) & 255, (w >> 16) & 255, (w >> 8) & 255, w & 255);
        },
        byte2lsb = function(w) {
            return String.fromCharCode(w & 255, (w >> 8) & 255);
        };

    return {
        constructor: function(width, height, depth) {
            var me = this,
                _crc32 = me.crc32 = [],
                i;

            me.width   = width;
            me.height  = height;
            me.depth   = depth;

            // pixel data and row filter identifier size
            me.pix_size = height * (width + 1);

            // deflate header, pix_size, block headers, adler32 checksum
            me.data_size = 2 + me.pix_size + 5 * Math.floor((0xfffe + me.pix_size) / 0xffff) + 4;

            // offsets and sizes of Png chunks
            me.ihdr_offs = 0;                                 // IHDR offset and size
            me.ihdr_size = 4 + 4 + 13 + 4;
            me.plte_offs = me.ihdr_offs + me.ihdr_size;   // PLTE offset and size
            me.plte_size = 4 + 4 + 3 * depth + 4;
            me.trns_offs = me.plte_offs + me.plte_size;   // tRNS offset and size
            me.trns_size = 4 + 4 + depth + 4;
            me.idat_offs = me.trns_offs + me.trns_size;   // IDAT offset and size
            me.idat_size = 4 + 4 + me.data_size + 4;
            me.iend_offs = me.idat_offs + me.idat_size;   // IEND offset and size
            me.iend_size = 4 + 4 + 4;
            me.buffer_size  = me.iend_offs + me.iend_size;    // total PNG size

            me.buffer  = [];
            me.palette = {};
            me.pindex  = 0;

            // initialize buffer with zero bytes
            for (i = 0; i < me.buffer_size; i++) {
                me.buffer[i] = '\x00';
            }

            // initialize non-zero elements
            write(me.buffer, me.ihdr_offs, byte4(me.ihdr_size - 12), 'IHDR', byte4(width), byte4(height), '\x08\x03');
            write(me.buffer, me.plte_offs, byte4(me.plte_size - 12), 'PLTE');
            write(me.buffer, me.trns_offs, byte4(me.trns_size - 12), 'tRNS');
            write(me.buffer, me.idat_offs, byte4(me.idat_size - 12), 'IDAT');
            write(me.buffer, me.iend_offs, byte4(me.iend_size - 12), 'IEND');

            // initialize deflate header
            var header = ((8 + (7 << 4)) << 8) | (3 << 6);
            header+= 31 - (header % 31);

            write(me.buffer, me.idat_offs + 8, byte2(header));

            // initialize deflate block headers
            for (i = 0; (i << 16) - 1 < me.pix_size; i++) {
                var size, bits;
                if (i + 0xffff < me.pix_size) {
                    size = 0xffff;
                    bits = '\x00';
                } else {
                    size = me.pix_size - (i << 16) - i;
                    bits = '\x01';
                }
                write(me.buffer, me.idat_offs + 8 + 2 + (i << 16) + (i << 2), bits, byte2lsb(size), byte2lsb(~size));
            }

            /* Create crc32 lookup table */
            for (i = 0; i < 256; i++) {
                var c = i;
                for (var j = 0; j < 8; j++) {
                    if (c & 1) {
                        c = -306674912 ^ ((c >> 1) & 0x7fffffff);
                    } else {
                        c = (c >> 1) & 0x7fffffff;
                    }
                }
                _crc32[i] = c;
            }
        },

        // compute the index into a png for a given pixel
        index: function(x,y) {
            var i = y * (this.width + 1) + x + 1;
            var j = this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
            return j;
        },

        // convert a color and build up the palette
        color: function(red, green, blue, alpha) {
            alpha = alpha >= 0 ? alpha : 255;

            var me = this,
                buffer = me.buffer,
                palette = me.palette,
                color = (((((alpha << 8) | red) << 8) | green) << 8) | blue,
                ndx;

            if (typeof palette[color] == 'undefined') {
                if (me.pindex == me.depth) {
                    return '\x00';
                }

                ndx = me.plte_offs + 8 + 3 * me.pindex;

                buffer[ndx + 0] = String.fromCharCode(red);
                buffer[ndx + 1] = String.fromCharCode(green);
                buffer[ndx + 2] = String.fromCharCode(blue);
                buffer[me.trns_offs+8+me.pindex] = String.fromCharCode(alpha);

                palette[color] = String.fromCharCode(me.pindex++);
            }

            return palette[color];
        },

        // output a PNG string, Base64 encoded
        getBase64: function() {

            var s = this.getDump(),
                ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
                l = s.length,
                i = 0,
                r = '',
                c1, c2, c3, e1, e2, e3, e4;

            do {
                c1 = s.charCodeAt(i);
                e1 = c1 >> 2;
                c2 = s.charCodeAt(i+1);
                e2 = ((c1 & 3) << 4) | (c2 >> 4);
                c3 = s.charCodeAt(i+2);
                if (l < i+2) { e3 = 64; } else { e3 = ((c2 & 0xf) << 2) | (c3 >> 6); }
                if (l < i+3) { e4 = 64; } else { e4 = c3 & 0x3f; }
                r+= ch.charAt(e1) + ch.charAt(e2) + ch.charAt(e3) + ch.charAt(e4);
            } while ((i+= 3) < l);

            return r;
        },

        // output a PNG string
        getDump: function() {

            // compute adler32 of output pixels + row filter bytes
            var me = this,
                buffer = me.buffer,
                BASE = 65521, /* largest prime smaller than 65536 */
                NMAX = 5552,  /* NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1 */
                s1 = 1,
                s2 = 0,
                n = NMAX,
                _crc32 = me.crc32,
                crc32 = function(png, offs, size) {
                    var crc = -1;
                    for (var i = 4; i < size-4; i += 1) {
                        crc = _crc32[(crc ^ png[offs+i].charCodeAt(0)) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
                    }
                    write(png, offs+size-4, byte4(crc ^ -1));
                };

            for (var y = 0; y < me.height; y++) {
                for (var x = -1; x < me.width; x++) {
                    s1+= me.buffer[me.index(x, y)].charCodeAt(0);
                    s2+= s1;
                    if ((n-= 1) == 0) {
                        s1%= BASE;
                        s2%= BASE;
                        n = NMAX;
                    }
                }
            }
            s1%= BASE;
            s2%= BASE;
            write(buffer, me.idat_offs + me.idat_size - 8, byte4((s2 << 16) | s1));

            // compute crc32 of the PNG chunks
            crc32(buffer, me.ihdr_offs, me.ihdr_size);
            crc32(buffer, me.plte_offs, me.plte_size);
            crc32(buffer, me.trns_offs, me.trns_size);
            crc32(buffer, me.idat_offs, me.idat_size);
            crc32(buffer, me.iend_offs, me.iend_size);

            // convert PNG to string
            return '\211PNG\r\n\032\n'+buffer.join('');
        }
    };
})());