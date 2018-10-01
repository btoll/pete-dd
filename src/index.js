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

import { core } from 'pete-core';
import { pete, dom, element, util } from 'pete-dom';

'use strict';

// initDD   = el can be both drag and drop zone
// dragZone = el can only be a dragzone, it cannot accept drops
// dropZone = el can only be a dropzone, it cannot initiate drags
//
// If a dragCls is not explicitly defined then any dom element can be a drag target.

const dragZones = {};
const dropZones = {};

// The cloned dom element.
let dragProxy;
// The original dom element that has been selected to be dragged.
let sourceEl;
// The zone target (an element id) where the dragged element will be dropped.
let dropZoneTarget;

function add(v, cfg) {
    if (!Array.isArray(v)) {
        const data = cfg.data;

        let els = v.isComposite ?
            v.elements :
            [element.get(v, true)];

        els.forEach(dom => {
            const el = element.get(dom);

            // TODO: Leaks!
            el.on('mousedown', onMouseDown.bind(this));
            el.on('mouseover', onMouseOver.bind(this));
            el.on('mouseout', onMouseOut.bind(this));

            // The `el` also now becomes a zone. Let's create a new variable so it reads better.
            const zone = el;

            // Let the Observer know what events can be subscribed to.
            zone.subscriberEvents([
                'beforenodedrop',
                'afternodedrop'
            ]);

            if (data.subscribe) {
                let subscribe = data.subscribe;

                for (let name of Object.keys(subscribe)) {
                    zone.subscribe(name, subscribe[name]);
                }
            }

            // TODO: Why?
            core.mixin(zone, data);

            addToZone(cfg.type, zone);

        });
    } else {
        dropZones.push(element.get(v));
    }
}

const addToZone = (type, el) => {
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

const getDragProxy = config => {
    if (!dragProxy) {
        dragProxy = core.create(element, config);
    } else {
        core.mixin(dragProxy, config);
    }

    return dragProxy;
};

const getSourceEl = config => {
    if (!sourceEl) {
        sourceEl = core.create(element, core.mixin({
            id: 'Pete_sourceEl'
        }, config));
    } else {
        core.mixin(sourceEl, config);
    }

    return sourceEl;
};

function onMouseDown(e) {
    const ownerId = element.get(e.currentTarget).dom._pete.ownerId;
    const dragZone = dragZones[ownerId];

    // Only continue if the ownerId is a participating dragZone.
    if (dragZone) {
        const doc = element.get(document);
        const body = document.body;
        // `dd` is the current DD object.
        const dragCls = this.dragCls;
        let target = e.target;

        // If the target doesn't have the class do an ancestor search upwards.
        if (!element.get(target).hasClass(dragCls)) {
            target = dom.find(target, `.${dragCls}`);
        }

        if (target) {
            sourceEl = getSourceEl({
                dom: target,
                ddOwner: ownerId
            });

            dragProxy = getDragProxy({
                // Clone the target node and any children.
                dom: target.cloneNode(true)
            });

            // Concatenate b/c we don't want to overwrite any class that may already be bound to it.
            dragProxy.addClass('Pete_dragging');
            body.appendChild(dragProxy.dom);

            // TODO
            doc.on('mousemove', onMouseMove);
        }

        // Cancel out any text selections.
        body.focus();

        if (pete.isIE) {
            doc.on('selectstart', onSelectStart);
        }
    }

    e.preventDefault();
}

const onMouseMove = e => {
    if (dragProxy) {
        dragProxy.setStyle({
            display: 'block',
            top: `${util.getY(e)}px`,
            left: `${util.getX(e)}px`
        });
    }
};

// NOTE: It's very important to listen to this event so onNodeDrop knows when it can remove
// the cloned node and when to remove the class when the node is over a no-drop area.
const onMouseOut = () => {
    if (dragProxy) {
        dropZoneTarget = null;
        element.fly(dragProxy).removeClass('Pete_overDropZone');
    }
};

const onMouseOver = e => {
    if (dragProxy) {
        let ownerId = e.target._pete.ownerId;

        // Only continue if the ownerId is a participating dropZone.
        if (sourceEl.ddOwner !== ownerId && dropZones[ownerId]) {
            dropZoneTarget = ownerId;
            element.fly(dragProxy).addClass('Pete_overDropZone');
        }
    }
};

function onNodeDrop(e) {
    const doc = element.get(document);
    const body = document.body;

    if (!dragProxy) {
        return;
    }

    // If dropZoneTarget is not null (from a no-drop area) or within the same drop zone.
    if (dropZoneTarget && dropZoneTarget.indexOf(sourceEl.ddOwner) === -1) {
        //zoneTarget = Pete.getDom(dropZoneTarget);
        let zoneTarget = element.get(dropZoneTarget, true);
        let o;

        if ((o = dropZones[dropZoneTarget])) {
            const context = {
                sourceEl: sourceEl,
                dropZoneTarget: dropZoneTarget,
                zoneTarget: zoneTarget
            };

            if (o.id !== sourceEl.ddOwner) {
                // Drop the node in the drop zone if developer-provided callback doesn't cancel the behavior.
                if (o.fire('beforenodedrop', e, this, context) !== false) {
                    // TODO
                    const el = o.dropProxy ?
                        dragProxy :
                        sourceEl;

                    // Remove the cloned node from the dom...
                    body.removeChild(dragProxy.dom);

                    // ...and re-append the original in the new drop zone.
                    zoneTarget.appendChild(el.dom);

                    // Swap out the previous zone owner for the new one.
                    sourceEl.ddOwner = o.id;

                    if (o.sort) {
                        sort(dropZoneTarget);
                    }

                    // What's with this comment?
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
    }

    // ...and remove the property so the check in the beginning of this method tcob.
    dragProxy = null;

    // TODO: if (Pete.isIE) ...
    doc.un('selectstart', onSelectStart);
    doc.un('mousemove', onMouseMove);
}

// Prevent text selection in IE.
const onSelectStart = () => false;

// Sort the drop zone's sortable elements after drop (NOTE that the sort is dependent upon a developer
// provided property called 'sortOrder').
const sort = dropZone => {
    // Get all child nodes within the drop zone that have a 'sortOrder' property.
    const arr = Array.from(dom.getDom(dropZone).childNodes).filter(v =>
        // Should there be a better check?
        (typeof v.sortOrder === 'number')
    );
    const frag = document.createDocumentFragment();
    const dz = element.get(dropZone);

    // Sort all nodes in this drop zone by their sort order property.
    arr.sort((a, b) => a.sortOrder - b.sortOrder);

    // Remove all the nodes...
    dz.remove(true);

    // ...and readd them to the document fragment.
    arr.forEach(dom => frag.appendChild(dom));

    dz.append(frag);
};

const wrap = type => {
    return function (el, o) {
        add.call(this, el, {
            type: type,
            data: o || {}
        });
    };
};

const dd = {
    $extend: function () {
        // TODO: Native support for once.
        // Only register the global 'mouseup' event once.
        if (!dd._eventRegistered) {
            // TODO: This will leak.
            element.get(document).on('mouseup', onNodeDrop.bind(this));
            dd._eventRegistered = true;
        }
    },

    _eventRegistered: false,

    getDropZones: () => dropZones,

    dragZone: wrap('drag'),
    dropZone: wrap('drop'),
    // Make it both a drag and a drop zone.
    initDD: wrap('DD')
};

export default dd;

