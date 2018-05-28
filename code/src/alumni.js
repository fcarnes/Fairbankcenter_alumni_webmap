require([
        "esri/map",
        "esri/layers/ArcGISTiledMapServiceLayer",
        //"esri/geometry/webMercatorUtils",
        "esri/geometry/Point",
        //"esri/layers/ArcGISDynamicMapServiceLayer",
        "esri/layers/FeatureLayer",
        "esri/dijit/Geocoder",
        "esri/dijit/HomeButton",
        "esri/InfoTemplate",
        "esri/graphic",
        "app/clusterfeaturelayer",
        "dojo/_base/Color",
        "esri/tasks/query",
        "esri/tasks/QueryTask",
        "dojo/domReady!"
    ],

    function(Map, ArcGISTiledMapServiceLayer, Point, FeatureLayer, Geocoder, HomeButton, InfoTemplate, Graphic, ClusterFeatureLayer, Color, Query, QueryTask) {

        // Locals
        var map,
            point,
            lat=20,
            lon=180,
            layer,
            query,
            popup,
            clusterLayer,
            geocoder,
            infoTemplate,
            selectedSym,
            activeClusterElement,
            AffList,
            clusterAffValue;

        

        // Create map
        map = new Map("mapDiv", {
            basemap: "dark-gray-vector",
            center: [lon, lat], //longtitude, latitude
            zoom: 2
        });

        //create a map center point object
        point = new Point([lon, lat]);

        // Add clusters 
        map.on("load", function() {
            // Add layer
            addClusterLayer(clusterAffValue);
            addClusterLayerEvents();
        });

    
        // Create geocoder widget
        var geocoder = new Geocoder({
            arcgisGeocoder: {
                placeholder: "Navigate to a place"
            },
            autoNavigate: true,
            autoComplete: true,
            map: map
        }, "search");
        geocoder.startup();


        //create home button widget
        var home = new HomeButton({
            map: map
        }, "homeButton");
        home.startup();

        //Auto-crreated the contents in the dropdown list based on the feature service layer

        //Get the feature service layer url from ArcGIS online, you need to change it here once this layer is changed.
        var featurelayer = "http://cga-app01.cadm.harvard.edu/arcgis/rest/services/alumni/alumni/MapServer/0";
        //var featurelayer = "http://services1.arcgis.com/qN3V93cYGMKQCOxL/arcgis/rest/services/Alumni_Final_Data_08292016/FeatureServer/0";
        //Add layer
        //layer = new ArcGISDynamicMapServiceLayer(featurelayer);
        layer = new FeatureLayer(featurelayer);
        //map.addLayer(layer);

        //initialize query task
        queryTask = new QueryTask(featurelayer);

        //initialize query
        query = new Query();
        query.returnGeometry = false;
        query.outFields = ["Affiliatio"];
        query.where = "Affiliatio <> ''";
        queryTask.execute(query, updateAffList);

        //read the feature service layer from the web and to compile the afflicates list 
        function updateAffList(results) {
            //create a empty affiliates list array
            var affListArry = new Array();
            //get the select element for affiliates list
            var pickAff = document.getElementById("aff_type");
            //create a new option element for the select 
            pickAff.options.length = 0;
            var optAff = new Option("All");
            pickAff.options[pickAff.options.length] = optAff;

            for (var i = 0, len = results.features.length; i < len; i++) {
                var affAttributes = results.features[i].attributes;
                for (attribute in affAttributes) {
                    var index = affListArry.indexOf(affAttributes.Affiliatio);
                    if (index == -1) {
                        affListArry.push(affAttributes.Affiliatio);
                    }
                }
            }
            
            //sort the order in the affiliation list array
            affListArry.sort();

            //affListArry.unshift("All");
            
            //write the affiliation list array to the pulldown menu list
            for (var j = 0; j < affListArry.length; j++) {
                var optAff = new Option(affListArry[j], affListArry[j]);
                pickAff.options[pickAff.options.length] = optAff;
            }
            pickAff.options[0].selected = "selected";
            //console.log(pickAff.selectedIndex);
        }

        // Save the last selected graphic
        map.infoWindow.on("selection-change", function() {
            addSelectedFeature();
        });

        // Set popup
        popup = map.infoWindow;
        popup.highlight = true;
        popup.titleInBody = false;
        popup.domNode.className += " light";

        // Popup content
        infoTemplate = new InfoTemplate("<b>Alumni Info</b>", "<p><strong>Name</strong>: ${First_Name} ${Last_Name}</p><p><strong>Type of Affiliation</strong>: ${Affilitio}</p><p><strong>Affiliation</strong>: ${Institutio}</p><p><strong>Starts</strong>: ${Start_Date:DateFormat(datePattern:'MMMM d, yyyy', selector:'date')}</p><p><strong>Ends</strong>: ${End_Date:DateFormat(datePattern:'MMMM d, yyyy', selector:'date')}</p>");

        //given default clusterAffValue, which will be used initially when the map is first loaded - load it all
        var affValue = "1=1";

        //query features based on the affiliation type picked 
        var clusterAff = document.getElementById("aff_type");

        clusterAff.options[0].selected = "selected";

        clusterAff.addEventListener("change", function() {
            //everytime affiliation type changes, 1) delete the previous selection graph 2) zoom to the map center
            map.removeLayer(clusterLayer);
            map.centerAndZoom(point, 2);
            popup.hide();
            //map.centerAt(lon, lat);
            if (clusterAff.value=='All'){
                addClusterLayer(affValue);
            }
            else{
                affValue2 = "Affiliatio = '" + clusterAff.value + "'";
                addClusterLayer(affValue2);
            }
            
        });

        // Create a feature layer to get feature service
        function addClusterLayer(affValue) {
            clusterLayer = new ClusterFeatureLayer({
                "url": featurelayer,
                "distance": 50,
                "where": affValue,
                "id": "clusters",
                "labelColor": "#fff",
                "resolution": map.extent.getWidth() / map.width,
                "singleTemplate": infoTemplate,
                "useDefaultSymbol": false,
                "zoomOnClick": true,
                "showSingles": false,
                "disablePopup": false,
                "objectIdField": "FID",
                outFields: ["First_Name", "Last_Name", "Affiliatio", "Institutio", "Start_Date", "End_Date"]
            });

            map.addLayer(clusterLayer);
        }

        // Hide popup if selected feature is clustered
        function onClustersShown(clusters) {
            var i = 0,
                extent;
               // console.log(map.infoWindow.isShowing); //false
                
            if (map.infoWindow.isShowing && map.infoWindow._lastSelected) {
                for (i; i < clusters.length; i++) {
                    if (clusters[i].attributes.clusterCount > 1) {
                        extent = clusterLayer._getClusterExtent(clusters[i]);
                        if (extent.contains(map.infoWindow._lastSelected.geometry)) {
                            map.infoWindow.hide();
                            break;
                        }
                    }
                }
            }
        }

        // Wire cluster layer events
        function addClusterLayerEvents() {
            //mouse over event
            clusterLayer.on("mouse-over", onMouseOverCluster);
            clusterLayer.on("mouse-out", onMouseOutCluster);
            // Clusters drawn
            clusterLayer.on("clusters-shown", onClustersShown);
        }

        // Set selected
        function addSelectedFeature() {
            var selIndex = map.infoWindow.selectedIndex,
                selFeature;
            if (selIndex !== -1) {
                selFeature = map.infoWindow.features[selIndex];
                // Remove old feature first
                removeSelectedFeature();
                // Add new graphic
                map.infoWindow._lastSelected = new Graphic(selFeature.toJson());
                map.infoWindow._lastSelected.setSymbol(selectedSym);
                map.graphics.add(map.infoWindow._lastSelected);
            }
        }

        // Remove selected
        function removeSelectedFeature() {
            if (map.infoWindow._lastSelected) {
                map.graphics.remove(map.infoWindow._lastSelected);
                map.infoWindow._lastSelected = null;
            }
        }

        // Highlight clusters
        function setActiveClusterOpacity(elem, fillOpacity, strokeOpacity) {
            var textElm;
            if (elem) {
                elem.setAttribute("fill-opacity", fillOpacity);
                elem.setAttribute("stroke-opacity", strokeOpacity);
                // Overide inherited properties for the text in the circle
                textElm = elem.nextElementSibling;
                if (textElm && textElm.nodeName === "text") {
                    textElm.setAttribute("fill-opacity", 1);
                }
            }
        }

        function onMouseOverCluster(e) {
            if (e.graphic.attributes.clusterCount === 1) {
                e.graphic._graphicsLayer.onClick(e);
            } else {
                if (e.target.nodeName === "circle") {
                    activeClusterElement = e.target;
                    setActiveClusterOpacity(activeClusterElement, 1, 1);
                } else {
                    setActiveClusterOpacity(activeClusterElement, 1, 1);
                }
            }
        }

        function onMouseOutCluster(e) {
            if (e.graphic.attributes.clusterCount > 1) {
                if (e.target.nodeName === "circle" || e.target.nodeName === "text") {
                    setActiveClusterOpacity(activeClusterElement, 0.75, 0.5);
                    setActiveClusterOpacity(e.target, 0.75, 0.5);
                }
            }
        }

    });