/*==================================================
 *  Exhibit.ScatterPlotView
 *==================================================
 */
Exhibit.ScatterPlotView = function(containerElmt, uiContext) {
    this._div = containerElmt;
    this._uiContext = uiContext;

    this._settings = {};
    this._accessors = {
        getPointLabel:  function(itemID, database, visitor) { visitor(database.getObject(itemID, "label")); },
        getProxy:       function(itemID, database, visitor) { visitor(itemID); }
    };
    
    // Function maps that allow for other axis scales (logarithmic, etc.), defaults to identity/linear
    this._axisFuncs = { x: function (x) { return x; }, y: function (y) { return y; } };
    this._axisInverseFuncs = { x: function (x) { return x; }, y: function (y) { return y; } };

    this._colorKeyCache = new Object();
    this._maxColor = 0;
    
    var view = this;
    this._listener = { 
        onItemsChanged: function() {
            view._reconstruct(); 
        }
    };
    uiContext.getCollection().addListener(this._listener);
};

Exhibit.ScatterPlotView._settingSpecs = {
    "plotHeight":   { type: "int",   defaultValue: 400 },
    "bubbleWidth":  { type: "int",   defaultValue: 400 },
    "bubbleHeight": { type: "int",   defaultValue: 300 },
    "xAxisMin":     { type: "float", defaultValue: Number.POSITIVE_INFINITY },
    "xAxisMax":     { type: "float", defaultValue: Number.NEGATIVE_INFINITY },
    "xAxisType":    { type: "enum",  defaultValue: "linear", choices: [ "linear", "log" ] },
    "yAxisMin":     { type: "float", defaultValue: Number.POSITIVE_INFINITY },
    "yAxisMax":     { type: "float", defaultValue: Number.NEGATIVE_INFINITY },
    "yAxisType":    { type: "enum",  defaultValue: "linear", choices: [ "linear", "log" ] },
    "xLabel":       { type: "text",  defaultValue: "x" },
    "yLabel":       { type: "text",  defaultValue: "y" }
};

Exhibit.ScatterPlotView._accessorSpecs = [
    {   accessorName:   "getProxy",
        attributeName:  "proxy"
    },
    {   accessorName:   "getPointLabel",
        attributeName:  "pointLabel"
    },
    {   accessorName: "getXY",
        alternatives: [
            {   bindings: [
                    {   attributeName:  "xy",
                        types:          [ "float", "float" ],
                        bindingNames:   [ "x", "y" ]
                    }
                ]
            },
            {   bindings: [
                    {   attributeName:  "x",
                        type:           "float",
                        bindingName:    "x"
                    },
                    {   attributeName:  "y",
                        type:           "float",
                        bindingName:    "y"
                    }
                ]
            }
        ]
    },
    {   accessorName:   "getColor",
        attributeName:  "color",
        type:           "text"
    }
];

Exhibit.ScatterPlotView.create = function(configuration, containerElmt, uiContext) {
    var view = new Exhibit.ScatterPlotView(
        containerElmt,
        Exhibit.UIContext.create(configuration, uiContext)
    );
    Exhibit.ScatterPlotView._configure(view, configuration);
    
    view._initializeUI();
    return view;
};

Exhibit.ScatterPlotView.createFromDOM = function(configElmt, containerElmt, uiContext) {
    var configuration = Exhibit.getConfigurationFromDOM(configElmt);
    var view = new Exhibit.ScatterPlotView(
        containerElmt != null ? containerElmt : configElmt, 
        Exhibit.UIContext.createFromDOM(configElmt, uiContext)
    );

    Exhibit.SettingsUtilities.createAccessorsFromDOM(configElmt, Exhibit.ScatterPlotView._accessorSpecs, view._accessors);
    Exhibit.SettingsUtilities.collectSettingsFromDOM(configElmt, Exhibit.ScatterPlotView._settingSpecs, view._settings);
    Exhibit.ScatterPlotView._configure(view, configuration);
    
    view._initializeUI();
    return view;
};

Exhibit.ScatterPlotView._configure = function(view, configuration) {
    Exhibit.SettingsUtilities.createAccessors(configuration, Exhibit.ScatterPlotView._accessorSpecs, view._accessors);
    Exhibit.SettingsUtilities.collectSettings(configuration, Exhibit.ScatterPlotView._settingSpecs, view._settings);

    view._axisFuncs.x = Exhibit.ScatterPlotView._getAxisFunc(view._settings.xAxisType);
    view._axisInverseFuncs.x = Exhibit.ScatterPlotView._getAxisInverseFunc(view._settings.xAxisType);
    
    view._axisFuncs.y = Exhibit.ScatterPlotView._getAxisFunc(view._settings.yAxisType);
    view._axisInverseFuncs.y = Exhibit.ScatterPlotView._getAxisInverseFunc(view._settings.yAxisType);
    
    var accessors = view._accessors;
    view._getXY = function(itemID, database, visitor) {
        accessors.getProxy(itemID, database, function(proxy) {
            accessors.getXY(proxy, database, visitor);
        });
    };
};

// Convenience function that maps strings to respective functions
Exhibit.ScatterPlotView._getAxisFunc = function(s) {
    if (s == "log") {
        return function (x) { return (Math.log(x) / Math.log(10.0)); };
    } else {
        return function (x) { return x; };
    }
}

// Convenience function that maps strings to respective functions
Exhibit.ScatterPlotView._getAxisInverseFunc = function(s) {
    if (s == "log") {
        return function (x) { return Math.pow(10, x); };
    } else {
        return function (x) { return x; };
    };
}

Exhibit.ScatterPlotView._colors = [
    "FF9000",
    "5D7CBA",
    "A97838",
    "8B9BBA",
    "FFC77F",
    "003EBA",
    "29447B",
    "543C1C"
];
Exhibit.ScatterPlotView._mixColor = "FFFFFF";

Exhibit.ScatterPlotView.evaluateSingle = function(expression, itemID, database) {
    return expression.evaluateSingleOnItem(itemID, database).value;
}

Exhibit.ScatterPlotView.prototype.dispose = function() {
    this._uiContext.getCollection().removeListener(this._listener);
    this._collectionSummaryWidget.dispose();
    this._uiContext.dispose();
    
    this._div.innerHTML = "";
    
    this._collectionSummaryWidget = null;
    this._uiContext = null;
    this._dom = null;
    this._div = null;
};

Exhibit.ScatterPlotView.prototype._initializeUI = function() {
    var self = this;
    
    this._div.innerHTML = "";
    this._dom = Exhibit.ScatterPlotView.theme.constructDom(
        this._div, 
        function() { return self._reconstruct(); }
    );
    this._collectionSummaryWidget = Exhibit.CollectionSummaryWidget.create(
        {}, 
        this._dom.collectionSummaryDiv, 
        this._uiContext
    );
    
    this._dom.plotContainer.style.height = this._settings.plotHeight + "px";
    this._reconstruct();
};

Exhibit.ScatterPlotView.prototype._reconstruct = function() {
    var self = this;
    var collection = this._uiContext.getCollection();
    var database = this._uiContext.getDatabase();
    var settings = this._settings;
    var accessors = this._accessors;
    
    this._dom.plotContainer.innerHTML = "";
    
    var scaleX = self._axisFuncs.x;
    var scaleY = self._axisFuncs.y;
    var unscaleX = self._axisInverseFuncs.x;
    var unscaleY = self._axisInverseFuncs.y;
    
    var currentSize = collection.countRestrictedItems();
    var mappableSize = 0;
    
    this._dom.clearLegend();
    if (currentSize > 0) {
        var currentSet = collection.getRestrictedItems();
        
        var xyToData = {};
        var xAxisMin = settings.xAxisMin;
        var xAxisMax = settings.xAxisMax;
        var yAxisMin = settings.yAxisMin;
        var yAxisMax = settings.yAxisMax;
        
        /*
         *  Iterate through all items, collecting min and max on both axes
         */
        currentSet.visit(function(itemID) {
            var xys = [];
            self._getXY(itemID, database, function(xy) { if ("x" in xy && "y" in xy) xys.push(xy); });
            
            if (xys.length > 0) {
                var colorKey = "";
                accessors.getColor(itemID, database, function(v) { colorKey = v; });
                
                for (var i = 0; i < xys.length; i++) {
                    var xy = xys[i];
                    var xyKey = xy.x + "," + xy.y;
                    if (xyKey in xyToData) {
                        var xyData = xyToData[xyKey];
                        xyData.items.push(itemID);
                        if (xyData.colorKey != colorKey) {
                            xyData.colorKey = null;
                        }
                    } else {
                        try {
                            xy.scaledX = scaleX(xy.x);
                            xy.scaledY = scaleY(xy.y);
                            if (!isFinite(xy.scaledX) || !isFinite(xy.scaledY)) {
                                continue;
                            }
                        } catch (e) {
                            continue; // ignore the point since we can't scale it, e.g., log(0)
                        }
                        
                        xyToData[xyKey] = {
                            xy:         xy,
                            items:      [ itemID ],
                            colorKey:  colorKey
                        };
                        
                        xAxisMin = Math.min(xAxisMin, xy.scaledX);
                        xAxisMax = Math.max(xAxisMax, xy.scaledX);
                        yAxisMin = Math.min(yAxisMin, xy.scaledY);
                        yAxisMax = Math.max(yAxisMax, xy.scaledY);
                    }
                    
                    mappableSize++;
                }
            }
        });
        
        /*
         *  Figure out scales, mins, and maxes for both axes
         */
        var xDiff = xAxisMax - xAxisMin;
        var yDiff = yAxisMax - yAxisMin;
        
        var xInterval = 1;
        if (xDiff > 1) {
            while (xInterval * 20 < xDiff) {
                xInterval *= 10;
            }
        } else {
            while (xInterval < xDiff * 20) {
                xInterval /= 10;
            }
        }
        xAxisMin = Math.floor(xAxisMin / xInterval) * xInterval;
        xAxisMax = Math.ceil(xAxisMax / xInterval) * xInterval;
        
        var yInterval = 1;
        if (yDiff > 1) {
            while (yInterval * 20 < yDiff) {
                yInterval *= 10;
            }
        } else {
            while (yInterval < yDiff * 20) {
                yInterval /= 10;
            }
        }
        yAxisMin = Math.floor(yAxisMin / yInterval) * yInterval;
        yAxisMax = Math.ceil(yAxisMax / yInterval) * yInterval;
        
        settings.xAxisMin = xAxisMin;
        settings.xAxisMax = xAxisMax;
        settings.yAxisMin = yAxisMin;
        settings.yAxisMax = yAxisMax;
        
        /*
         *  Construct plot's frame
         */
        var canvasFrame = document.createElement("div");
        canvasFrame.className = SimileAjax.Platform.browser.isIE ?
            "exhibit-scatterPlotView-canvasFrame-ie" :
            "exhibit-scatterPlotView-canvasFrame";
        this._dom.plotContainer.appendChild(canvasFrame);
        
        var canvasDiv = document.createElement("div");
        canvasDiv.className = "exhibit-scatterPlotView-canvas";
        canvasDiv.style.height = "100%";
        canvasFrame.appendChild(canvasDiv);
        
        var xAxisDiv = document.createElement("div");
        xAxisDiv.className = "exhibit-scatterPlotView-xAxis";
        this._dom.plotContainer.appendChild(xAxisDiv);
        
        var xAxisDivInner = document.createElement("div");
        xAxisDivInner.style.position = "relative";
        xAxisDiv.appendChild(xAxisDivInner);
        
        var yAxisDiv = document.createElement("div");
        yAxisDiv.className = SimileAjax.Platform.browser.isIE ?
            "exhibit-scatterPlotView-yAxis-ie" :
            "exhibit-scatterPlotView-yAxis";
        this._dom.plotContainer.appendChild(yAxisDiv);
        
        var yAxisDivInner = document.createElement("div");
        yAxisDivInner.style.position = "relative";
        yAxisDivInner.style.height = "100%";
        yAxisDiv.appendChild(yAxisDivInner);
        
        var canvasWidth = canvasDiv.offsetWidth;
        var canvasHeight = canvasDiv.offsetHeight;
        var xScale = canvasWidth / (xAxisMax - xAxisMin);
        var yScale = canvasHeight / (yAxisMax - yAxisMin);
        
        canvasDiv.style.display = "none";
        
        /*
         *  Construct plot's grid lines and axis labels
         */
        var makeMakeLabel = function(interval, unscale) {
            // Intelligently deal with non-linear scales
            if (interval >= 1000000) {
                return function (n) { return Math.floor(unscale(n) / 1000000) + "M"; };
            } else if (interval >= 1000) {
                return function (n) { return Math.floor(unscale(n) / 1000) + "K"; };
            } else {
                return function (n) { return unscale(n); };
            }
        };
        var makeLabelX = makeMakeLabel(xInterval, unscaleX);
        var makeLabelY = makeMakeLabel(yInterval, unscaleY);
        
        for (var x = xAxisMin + xInterval; x < xAxisMax; x += xInterval) {
            var left = Math.floor((x - xAxisMin) * xScale);
            
            var div = document.createElement("div");
            div.className = "exhibit-scatterPlotView-gridLine";
            div.style.width = "1px";
            div.style.left = left + "px";
            div.style.top = "0px";
            div.style.height = "100%";
            canvasDiv.appendChild(div);
            
            var labelDiv = document.createElement("div");
            labelDiv.className = "exhibit-scatterPlotView-xAxisLabel";
            labelDiv.style.left = left + "px";
            labelDiv.innerHTML = makeLabelX(x);
            xAxisDivInner.appendChild(labelDiv);
        }
        var xNameDiv = document.createElement("div");
        xNameDiv.className = "exhibit-scatterPlotView-xAxisName";
        xNameDiv.innerHTML = settings.xLabel;
        xAxisDivInner.appendChild(xNameDiv);
            
        for (var y = yAxisMin + yInterval; y < yAxisMax; y += yInterval) {
            var bottom = Math.floor((y - yAxisMin) * yScale);
            
            var div = document.createElement("div");
            div.className = "exhibit-scatterPlotView-gridLine";
            div.style.height = "1px";
            div.style.bottom = bottom + "px";
            div.style.left = "0px";
            div.style.width = "100%";
            canvasDiv.appendChild(div);
            
            var labelDiv = document.createElement("div");
            labelDiv.className = "exhibit-scatterPlotView-yAxisLabel";
            labelDiv.style.bottom = bottom + "px";
            labelDiv.innerHTML = makeLabelY(y);
            yAxisDivInner.appendChild(labelDiv);
        }
        var yNameDiv = document.createElement("div");
        yNameDiv.className = "exhibit-scatterPlotView-yAxisName";
        yNameDiv.innerHTML = settings.yLabel;
        yAxisDivInner.appendChild(yNameDiv);
        
        /*
         *  Plot the points
         */
        var usedKeys = {};
        var addPointAtLocation = function(xyData) {
            var items = xyData.items;
            
            var color;
            if (xyData.colorKey == null) {
                color = Exhibit.ScatterPlotView._mixColor;
            } else {
                usedKeys[xyData.colorKey] = true;
                if (xyData.colorKey in self._colorKeyCache) {
                    color = self._colorKeyCache[xyData.colorKey];
                } else {
                    color = Exhibit.ScatterPlotView._colors[self._maxColor];
                    self._colorKeyCache[xyData.colorKey] = color;
                    self._maxColor = (self._maxColor + 1) % Exhibit.ScatterPlotView._colors.length;
                }
            }
            
            var xy = xyData.xy;
            var marker = Exhibit.ScatterPlotView._makePoint(
                color,
                Math.floor((xy.scaledX - xAxisMin) * xScale),
                Math.floor((xy.scaledY - yAxisMin) * yScale),
                xyData.items + ": " + 
                    settings.xLabel + " = " + xy.x + ", " +
                    settings.yLabel + " = " + xy.y
            );
            
            SimileAjax.WindowManager.registerEvent(marker, "click", function(elmt, evt, target) {
                self._openPopup(marker, items);
                SimileAjax.DOM.cancelEvent(evt);
                return false;
            });

            canvasDiv.appendChild(marker);
        }
        
        for (xyKey in xyToData) {
            addPointAtLocation(xyToData[xyKey]);
        }
        canvasDiv.style.display = "block";
        
        /*
         *  Draw the legends
         */
        var legendLabels = [];
        var legendColors = [];
        for (colorKey in this._colorKeyCache) {
            if (colorKey in usedKeys) {
                var color = this._colorKeyCache[colorKey];
                legendLabels.push(colorKey);
                legendColors.push("#" + color);
            }
        }
        legendLabels.push(Exhibit.ScatterPlotView.l10n.mixedLegendKey);
        legendColors.push("white");
        
        this._dom.addLegendBlock(Exhibit.ScatterPlotView.theme.constructLegendBlockDom(
            Exhibit.ScatterPlotView.l10n.colorLegendTitle,
            legendColors,
            legendLabels
        ));
    }
    this._dom.setPlottableCounts(currentSize, mappableSize);
};

Exhibit.ScatterPlotView.prototype._openPopup = function(elmt, items) {
    Exhibit.ViewUtilities.openBubbleForItems(
        elmt, 
        items, 
        this._uiContext
    );
};

Exhibit.ScatterPlotView._makePoint = function(color, left, bottom, tooltip) {
    var outer = document.createElement("div");
    outer.innerHTML = "<div class='exhibit-scatterPlotView-point' style='background: #" + color + 
        "; width: 6px; height: 6px; left: " + left + "px; bottom: " + bottom + "px;' title='" + tooltip + "'></div>";
        
    return outer.firstChild;
};
