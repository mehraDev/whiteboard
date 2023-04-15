/**
 *                        WHITEBOPHIR
 *********************************************************
 * @licstart  The following is the entire license notice for the
 *  JavaScript code in this page.
 *
 * Copyright (C) 2013  Ophir LOJKINE
 *
 *
 * The JavaScript code in this page is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License (GNU GPL) as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.  The code is distributed WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
 *
 * As additional permission under GNU GPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * @licend
 */

 (function () { //Code isolation

  // Allocate the full maximum server update rate to pencil messages.
  // This feels a bit risky in terms of dropped messages, but any less
  // gives terrible results with the default parameters.  In practice it
  // seems to work, either because writing tends to happen in bursts, or
  // maybe because the messages are sent when the time interval is *greater*
  // than this?
  var MIN_PENCIL_INTERVAL_MS = Tools.server_config.MAX_EMIT_COUNT_PERIOD / Tools.server_config.MAX_EMIT_COUNT;

  //Indicates the id of the line the user is currently drawing or an empty string while the user is not drawing
  var curLineId = "",
    lastTime = performance.now(); //The time at which the last point was drawn
  var curLine = {};
  var pointA = {},
  pointB = {},
  pointC = {};
  var startPoint = {};
  var svg = Tools.svg;

  pointA = {
    'type': 'point',
    'id': curLineId + 'A',
    'color': 'black',
    'size': 10,
    'opacity': Tools.getOpacity(),
    'cx': 500,
    'cy': 500,
    'radius': 0,
    'class': 'pointA',
  }

  pointC = {
    'type': 'point',
    'id': curLineId + 'C',
    'color': 'black',
    'size': 10,
    'opacity': Tools.getOpacity(),
    'cx': 700,
    'cy': 500,
    'radius': 0,
    'class': 'pointC',
  }

  pointB = {
    'type': 'point',
    'id': curLineId + 'B',
    'color': 'black',
    'size': 10,
    'opacity': Tools.getOpacity(),
    'cx': 600,
    'cy': 300,
    'radius': 0,
    'class': 'pointB',
  }

  createLine(pointA);
  createLine(pointB);
  createLine(pointC);

  //The data of the message that will be sent for every new point
  function PointMessage(x, y) {
    this.type = 'child';
    this.parent = curLineId;
    this.name = curLine.name;
    this.x = x;
    this.y = y;
  }

  function startLine(x, y, evt) {

    //Prevent the press from being interpreted by the browser
    evt.preventDefault();

    curLineId = Tools.generateUID("l"); //"l" for line

    console.log(evt.target);

    if (evt && evt.target && evt.target.classList && (evt.target.classList.contains('pointA') || evt.target.classList.contains('pointB') || evt.target.classList.contains('pointC'))) {
      if (evt.target.classList.contains('pointB')) {
        curLine = {
          'type': 'line',
          'id': curLineId,
          'color': Tools.getColor(),
          'size': Tools.getSize(),
          'opacity': Tools.getOpacity(),
          'cx': pointC.cx,
          'cy': pointC.cy,
          'radius': pointC.cx - pointA.cx,
          'name': (compassTool.secondary.active ? 'circle' : 'arc'),
        }

        Tools.drawAndSend(curLine);

        //Immediatly add a point to the line
        continueLine(x, y, evt);
      }

    }
  }

  function continueLine(x, y, evt) {
    /*Wait 70ms before adding any point to the currently drawing line.
    This allows the animation to be smother*/
    if (curLineId !== "" && performance.now() - lastTime > MIN_PENCIL_INTERVAL_MS) {
      Tools.drawAndSend(new PointMessage(x, y));
      lastTime = performance.now();
    }
    if (evt) evt.preventDefault();
  }

  function stopLineAt(x, y) {
    //Add a last point to the line
    continueLine(x, y);
    stopLine();
  }

  function stopLine() {
    startPoint = {};
    curLine = {};
    curLineId = "";
  }

  var renderingLine = {};
  function draw(data) {
    Tools.drawingEvent = true;
    switch (data.type) {
      case "point":
        renderingLine = createLine(data);
        break;
      case "line":
        renderingLine = createLine(data);
        break;
      case "child":
        var line = (renderingLine.id === data.parent) ? renderingLine : svg.getElementById(data.parent);
        if (!line) {
          console.error("Compass: Hmmm... I received a point of a line that has not been created (%s).", data.parent);
          line = renderingLine = createLine(
            {
              //create a new line in order not to loose the points
              id: data.parent,
              x: data["x"],
              y: data["y"],
            }
          ); //create a new line in order not to loose the points
        }
        curLine.cx = data.x;
        curLine.cy = data.y;
        curLine.name = data.name;
        addPoint(line, data.x, data.y);
        break;
      case "endline":
        //TODO?
        break;
      default:
        console.error("Compass: Draw instruction with unknown type. ", data);
        break;
    }
  }

  var pathDataCache = {};
  function getPathData(line) {
    var pathData = pathDataCache[line.id];
    if (!pathData) {
      pathData = line.getPathData();
      pathDataCache[line.id] = pathData;
    }
    return pathData;
  }

  function calcAngleDegrees(x, y) {
    return Math.atan2(y, x) * 180 / Math.PI;
  }

  function addPoint(circle, cx, cy) {
    var dAx = cx - pointA.cx;
    var dAy = cy - pointA.cy;
    var dBx = pointC.cx - pointA.cx;
    var dBy = pointC.cy - pointA.cy;
    var angle1 = Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy);
    var degree_angle = 0;
    if(angle1 < 0) {degree_angle = 360-(angle1 * -1 * (180 / Math.PI))}
    else {degree_angle = (angle1 * (180 / Math.PI))}

    let angle = degree_angle;
    const radius = (pointC.cx - pointA.cx);
    const circumference = 2 * Math.PI * radius;
    const strokeOffset = (1) * circumference;
    const strokeDasharray = (angle / 360) * circumference;

    circle.setAttribute('r', radius);
    circle.setAttribute('stroke-dasharray', [
      strokeDasharray,
      circumference - strokeDasharray
    ]);
    circle.setAttribute('stroke-dashoffset', strokeOffset);

  }

  function createLine(lineData) {
    startPoint.x = lineData.x || lineData.cx;
    startPoint.y = lineData.y || lineData.cy;
    //Creates a new line on the canvas, or update a line that already exists with new information
    var line = lineData.type === 'point' ? svg.getElementById(lineData.id) || Tools.createSVGElement("path") : svg.getElementById(lineData.id) || Tools.createSVGElement("circle");
    line.id = lineData.id;

    //If some data is not provided, choose default value. The line may be updated later
    line.setAttribute("stroke", lineData.color || "black");
    // line.setAttribute("stroke-width", lineData.size || 10);
    // line.setAttribute("opacity", Math.max(0.1, Math.min(1, lineData.opacity)) || 1);
    if (lineData.type === 'point') {
      line.setAttribute("d", 'M '+lineData.cx+' '+lineData.cy+' m -5, 0 a 5,5 0 1,1 10,0 a 5,5 0 1,1 -10,0');
      line.setAttribute("class", lineData.class);
      line.setAttribute("fill", 'black');
    } else {
      line.setAttribute("cx", pointA.cx);
      line.setAttribute("cy", pointA.cy);
    }

    Tools.drawingArea.appendChild(line);
    return line;
  }

  var compassTool = {
    "name": "Compass",
    "shortcut": "l",
    "listeners": {
      "press": startLine,
      "move": continueLine,
      "release": stopLineAt,
    },
    "secondary": {
      "name": "Compass",
      "icon": "tools/compass/compassIcon.svg",
      "active": false,
      "switch": function () {
        stopLine();
      },
    },
    "draw": draw,
    mouseCursor: "crosshair",
    icon: "tools/compass/compassIcon.svg",
    stylesheet: "tools/compass/compass.css",
  };
  Tools.add(compassTool);

})(); //End of code isolation
