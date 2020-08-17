"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _peteCore = require("pete-core");

var _peteDom = require("pete-dom");

/**
 * Copyright (c) 2009 - 2018 Benjamin Toll (benjamintoll.com)
 *
 * This file is part of pete-dd.
 *
 * pete-dd is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * pete-dd is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with pete-dd.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
'use strict'; // initDD   = el can be both drag and drop zone
// dragZone = el can only be a dragzone, it cannot accept drops
// dropZone = el can only be a dropzone, it cannot initiate drags
//
// If a dragCls is not explicitly defined then any dom element can be a drag target.


var dragZones = {};
var dropZones = {}; // The cloned dom element.

var dragProxy; // The original dom element that has been selected to be dragged.

var sourceEl; // The zone target (an element id) where the dragged element will be dropped.

var dropZoneTarget;

function add(v, cfg) {
  var _this = this;

  if (!Array.isArray(v)) {
    var data = cfg.data;
    var els = v.isComposite ? v.elements : [_peteDom.element.get(v, true)];
    els.forEach(function (dom) {
      var el = _peteDom.element.get(dom); // TODO: Leaks!


      el.on('mousedown', onMouseDown.bind(_this));
      el.on('mouseover', onMouseOver.bind(_this));
      el.on('mouseout', onMouseOut.bind(_this)); // The `el` also now becomes a zone. Let's create a new variable so it reads better.

      var zone = el; // Let the Observer know what events can be subscribed to.

      zone.subscriberEvents(['beforenodedrop', 'afternodedrop']);

      if (data.subscribe) {
        var subscribe = data.subscribe;

        var _arr = Object.keys(subscribe);

        for (var _i = 0; _i < _arr.length; _i++) {
          var name = _arr[_i];
          zone.subscribe(name, subscribe[name]);
        }
      } // TODO: Why?


      _peteCore.core.mixin(zone, data);

      addToZone(cfg.type, zone);
    });
  } else {
    dropZones.push(_peteDom.element.get(v));
  }
}

var addToZone = function addToZone(type, el) {
  switch (type) {
    case 'drag':
      dragZones[el.id] = el;
      break;

    case 'drop':
      dropZones[el.id] = el;
      break;

    default:
      dragZones[el.id] = dropZones[el.id] = el;
  }
};

var getDragProxy = function getDragProxy(config) {
  if (!dragProxy) {
    dragProxy = _peteCore.core.create(_peteDom.element, config);
  } else {
    _peteCore.core.mixin(dragProxy, config);
  }

  return dragProxy;
};

var getSourceEl = function getSourceEl(config) {
  if (!sourceEl) {
    sourceEl = _peteCore.core.create(_peteDom.element, _peteCore.core.mixin({
      id: 'Pete_sourceEl'
    }, config));
  } else {
    _peteCore.core.mixin(sourceEl, config);
  }

  return sourceEl;
};

function onMouseDown(e) {
  var ownerId = _peteDom.element.get(e.currentTarget).dom._pete.ownerId;

  var dragZone = dragZones[ownerId]; // Only continue if the ownerId is a participating dragZone.

  if (dragZone) {
    var doc = _peteDom.element.get(document);

    var body = document.body; // `dd` is the current DD object.

    var dragCls = this.dragCls;
    var target = e.target; // If the target doesn't have the class do an ancestor search upwards.

    if (!_peteDom.element.get(target).hasClass(dragCls)) {
      target = _peteDom.dom.find(target, ".".concat(dragCls));
    }

    if (target) {
      sourceEl = getSourceEl({
        dom: target,
        ddOwner: ownerId
      });
      dragProxy = getDragProxy({
        // Clone the target node and any children.
        dom: target.cloneNode(true)
      }); // Concatenate b/c we don't want to overwrite any class that may already be bound to it.

      dragProxy.addClass('Pete_dragging');
      body.appendChild(dragProxy.dom); // TODO

      doc.on('mousemove', onMouseMove);
    } // Cancel out any text selections.


    body.focus();

    if (_peteDom.pete.isIE) {
      doc.on('selectstart', onSelectStart);
    }
  }

  e.preventDefault();
}

var onMouseMove = function onMouseMove(e) {
  if (dragProxy) {
    dragProxy.setStyle({
      display: 'block',
      top: "".concat(_peteDom.util.getY(e), "px"),
      left: "".concat(_peteDom.util.getX(e), "px")
    });
  }
}; // NOTE: It's very important to listen to this event so onNodeDrop knows when it can remove
// the cloned node and when to remove the class when the node is over a no-drop area.


var onMouseOut = function onMouseOut() {
  if (dragProxy) {
    dropZoneTarget = null;

    _peteDom.element.fly(dragProxy).removeClass('Pete_overDropZone');
  }
};

var onMouseOver = function onMouseOver(e) {
  if (dragProxy) {
    var ownerId = e.target._pete.ownerId; // Only continue if the ownerId is a participating dropZone.

    if (sourceEl.ddOwner !== ownerId && dropZones[ownerId]) {
      dropZoneTarget = ownerId;

      _peteDom.element.fly(dragProxy).addClass('Pete_overDropZone');
    }
  }
};

function onNodeDrop(e) {
  var doc = _peteDom.element.get(document);

  var body = document.body;

  if (!dragProxy) {
    return;
  } // If dropZoneTarget is not null (from a no-drop area) or within the same drop zone.


  if (dropZoneTarget && dropZoneTarget.indexOf(sourceEl.ddOwner) === -1) {
    //zoneTarget = Pete.getDom(dropZoneTarget);
    var zoneTarget = _peteDom.element.get(dropZoneTarget, true);

    var o;

    if (o = dropZones[dropZoneTarget]) {
      var context = {
        sourceEl: sourceEl,
        dropZoneTarget: dropZoneTarget,
        zoneTarget: zoneTarget
      };

      if (o.id !== sourceEl.ddOwner) {
        // Drop the node in the drop zone if developer-provided callback doesn't cancel the behavior.
        if (o.fire('beforenodedrop', e, this, context) !== false) {
          // TODO
          var el = o.dropProxy ? dragProxy : sourceEl; // Remove the cloned node from the dom...

          body.removeChild(dragProxy.dom); // ...and re-append the original in the new drop zone.

          zoneTarget.appendChild(el.dom); // Swap out the previous zone owner for the new one.

          sourceEl.ddOwner = o.id;

          if (o.sort) {
            sort(dropZoneTarget);
          } // What's with this comment?
          // NOTE: If it's already been snapped to zone and is dropped into another snapped zone, don't do
          // anything above b/c it's already been snapped and has its original styles bound to itself.
          // `this` is the current DD object.


          o.fire('afternodedrop', e, this, context);
        } else {
          body.removeChild(dragProxy.dom);
        }
      }
    }
  } else {
    // Remove the cloned node from the dom...
    body.removeChild(dragProxy.dom);
  } // ...and remove the property so the check in the beginning of this method tcob.


  dragProxy = null; // TODO: if (Pete.isIE) ...

  doc.un('selectstart', onSelectStart);
  doc.un('mousemove', onMouseMove);
} // Prevent text selection in IE.


var onSelectStart = function onSelectStart() {
  return false;
}; // Sort the drop zone's sortable elements after drop (NOTE that the sort is dependent upon a developer
// provided property called 'sortOrder').


var sort = function sort(dropZone) {
  // Get all child nodes within the drop zone that have a 'sortOrder' property.
  var arr = Array.from(_peteDom.dom.getDom(dropZone).childNodes).filter(function (v) {
    return (// Should there be a better check?
      typeof v.sortOrder === 'number'
    );
  });
  var frag = document.createDocumentFragment();

  var dz = _peteDom.element.get(dropZone); // Sort all nodes in this drop zone by their sort order property.


  arr.sort(function (a, b) {
    return a.sortOrder - b.sortOrder;
  }); // Remove all the nodes...

  dz.remove(true); // ...and readd them to the document fragment.

  arr.forEach(function (dom) {
    return frag.appendChild(dom);
  });
  dz.append(frag);
};

var wrap = function wrap(type) {
  return function (el, o) {
    add.call(this, el, {
      type: type,
      data: o || {}
    });
  };
};

var dd = {
  $extend: function $extend() {
    // TODO: Native support for once.
    // Only register the global 'mouseup' event once.
    if (!dd._eventRegistered) {
      // TODO: This will leak.
      _peteDom.element.get(document).on('mouseup', onNodeDrop.bind(this));

      dd._eventRegistered = true;
    }
  },
  _eventRegistered: false,
  getDropZones: function getDropZones() {
    return dropZones;
  },
  dragZone: wrap('drag'),
  dropZone: wrap('drop'),
  // Make it both a drag and a drop zone.
  initDD: wrap('DD')
};
var _default = dd;
exports.default = _default;