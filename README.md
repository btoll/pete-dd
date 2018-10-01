# pete-dd

`pete-dd` exposes the drag and drop module.

+ <a href="#dd">dd</a>

## dd

        const dd = {
            $extend: function () { ... },

            _eventRegistered: false,

            getDropZones: () => dropZones,

            dragZone: wrap('drag'),
            dropZone: wrap('drop'),
            // Make it both a drag and a drop zone.
            initDD: wrap('DD')
        };

## License

[GPLv3](COPYING)

## Author

Benjamin Toll

