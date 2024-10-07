// Variables globales
var stylePozos = {
    radius: 8,
    fillColor: "#17202A",
    color: "#FDFEFE",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

var geojson;

var CyclOSM = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

// var mapabase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// });
var featureLayer = L.geoJson(null, {
    //pointToLayer: function(feature, latlng) { // por alguna razón no funcionan los PopUps al cargar los acuíferos al aplicar esta simbología en los marcadores, hay que revisar esta parte.
        // Crea un marcador circular con el estilo deseado
    //    return L.circleMarker(latlng, stylePozos);
    //},
    onEachFeature: function(feature, layer) {
        layer.bindPopup(createPopupContent(feature));
        layer.bindTooltip(feature.properties.NOMBRE_POZ, { permanent: true, direction: 'right', className: 'pozo-tooltip' });
        layer.id = feature.properties.NOMBRE_POZ;
    }
});

var acuiferosLayer = L.geoJson(null, {
    onEachFeature: function(feature, layer) {
        //layer.bindPopup("Información del acuífero: " + feature.properties.NOMBRE_ACU);
        layer.bindTooltip(feature.properties.NOMBRE_ACU, { permanent: true, direction: 'center', className: 'acuifero-tooltip' });
    }
});

var map; // Variable global del mapa

// Inicialización del mapa
function initializeMap() {
    map = L.map("map", {
        //layers: [CyclOSM, mapabase, featureLayer] // Agrega CyclOSM y otras capas al inicio
        layers: [CyclOSM, featureLayer, acuiferosLayer] 
    }).setView([23.4326, -102.1332], 5); // Centrar en México

    $.getJSON("assets/geojson/pozos.geojson", function(data) {
        geojson = data;
        buildStatesDropdown();
        $("#loading-mask").hide();
    });
    L.control.scale().addTo(map);
    // Añadir el widget de Control de Capas
    L.control.layers({
        "CyclOSM": CyclOSM,
        //"OSM": mapabase
    }, {
        "Pozos": featureLayer,
        "Acuíferos": acuiferosLayer
    }).addTo(map);
}


// Construir el dropdown de Estados
function buildStatesDropdown() {
    var states = [...new Set(geojson.features.map(feature => feature.properties.NOMBRE_EST))];
    var statesDropdown = $("#estados");
    statesDropdown.empty();
    // statesDropdown.append('<option value="all">Todos los Estados</option>'); Revisar porqué se crashea con todos los Estados como opción
    statesDropdown.append('<option value=" ">Selecciona un Estado</option>');
    states.forEach(function(state) {
        statesDropdown.append('<option value="' + state + '">' + state + '</option>');
    });
}

// Construir el dropdown de Acuíferos
function buildAquifersDropdown() {
    var selectedState = $("#estados").val();
    var aquifers = [...new Set(
        geojson.features
            .filter(feature => selectedState === "all" || feature.properties.NOMBRE_EST === selectedState)
            .map(feature => feature.properties.NOMBRE_ACU)
    )];
    var aquifersDropdown = $("#acuiferos");
    aquifersDropdown.empty();
    aquifersDropdown.append('<option value="all">Todos los Acuíferos</option>');
    aquifers.forEach(function(aquifer) {
        aquifersDropdown.append('<option value="' + aquifer + '">' + aquifer + '</option>');
    });
}

// Cargar y actualizar la capa de acuíferos
function loadAcuiferosLayer() {
    var selectedAquifer = $("#acuiferos").val();

    // Eliminar tooltips existentes
    acuiferosLayer.eachLayer(function(layer) {
        layer.unbindTooltip();
    });

    $.getJSON("assets/geojson/acuiferos.geojson", function(data) {
        // Filtrar acuíferos según la selección
        var filteredAcuiferos = data.features.filter(function(feature) {
            return selectedAquifer === "all" || feature.properties.NOM_ACUI === selectedAquifer;
        });

        acuiferosLayer.clearLayers();
        acuiferosLayer.addData({
            type: "FeatureCollection",
            features: filteredAcuiferos
        }); //.addTo(map); // con esta instrucción, se carga sólo el polígono del Acuífero seleccionado.

        // Añadir tooltips a los acuíferos después de cargar
        acuiferosLayer.eachLayer(function(layer) {
            layer.bindTooltip(layer.feature.properties.NOM_ACUI, { permanent: true, direction: 'center', className: 'custom-tooltip' });
        });
    });
}

acuiferosLayer.clearLayers();

// Actualizar los pozos en el mapa
function updateWellsLayer() {
    var selectedAquifer = $("#acuiferos").val();
    var selectedState = $("#estados").val();

    var filteredFeatures = geojson.features.filter(function(feature) {
        return (selectedAquifer === "all" || feature.properties.NOMBRE_ACU === selectedAquifer) &&
               (selectedState === "all" || feature.properties.NOMBRE_EST === selectedState);
    });

    featureLayer.clearLayers();
    
    featureLayer.addData({
        type: "FeatureCollection",
        features: filteredFeatures
    });

    // Zoom al área de los pozos visibles
    if (filteredFeatures.length > 0) {
        var bounds = L.geoJson(filteredFeatures).getBounds();
        map.fitBounds(bounds);
    }
    acuiferosLayer.clearLayers();
    // Actualizar la capa de acuíferos según la selección
    loadAcuiferosLayer();
}
featureLayer.clearLayers();

// Construir la tabla de datos
function buildTable() {
    var selectedAquifer = $("#acuiferos").val();
    var selectedState = $("#estados").val();

    var filteredFeatures = geojson.features.filter(function(feature) {
        return (selectedAquifer === "all" || feature.properties.NOMBRE_ACU === selectedAquifer) &&
               (selectedState === "all" || feature.properties.NOMBRE_EST === selectedState);
    });

    // Re-inicializar la DataTable solo si es necesario
    if ($.fn.DataTable.isDataTable('#data-table')) {
        $("#data-table").DataTable().clear().rows.add(filteredFeatures.map(function(feature) {
            return [
                feature.properties.NOMBRE_POZ,
                feature.properties.NOMBRE_EST,
                feature.properties.NOMBRE_ACU,
                feature.properties.ELEV_BROCA,
                feature.properties.PNE_1996,
                feature.properties.PNE_1997,
                feature.properties.PNE_1998,
                feature.properties.PNE_1999,
                feature.properties.PNE_2000,
                feature.properties.PNE_2001,
                feature.properties.PNE_2002,
                feature.properties.PNE_2003,
                feature.properties.PNE_2004,
                feature.properties.PNE_2005,
                feature.properties.PNE_2006,
                feature.properties.PNE_2007,
                feature.properties.PNE_2008,
                feature.properties.PNE_2009,
                feature.properties.PNE_2010,
                feature.properties.PNE_2011,
                feature.properties.PNE_2012,
                feature.properties.PNE_2013,
                feature.properties.PNE_2014,
                feature.properties.PNE_2015,
                feature.properties.PNE_2016,
                feature.properties.PNE_2017,
                feature.properties.PNE_2018,
                feature.properties.PNE_2019,
                feature.properties.PNE_2020,
                feature.properties.PNE_2021,
                feature.properties.PNE_2022,
                feature.properties.PNE_2023          

                //feature.properties.OTRO_ATTRIBUTO // Cambiar si es necesario
            ];
        })).draw();
    } else {
        $("#data-table").DataTable({
            data: filteredFeatures.map(function(feature) {
                return [
                    feature.properties.NOMBRE_POZ,
                    feature.properties.NOMBRE_EST,
                    feature.properties.NOMBRE_ACU,
                    feature.properties.ELEV_BROCA,
                    feature.properties.PNE_1996,
                    feature.properties.PNE_1997,
                    feature.properties.PNE_1998,
                    feature.properties.PNE_1999,
                    feature.properties.PNE_2000,
                    feature.properties.PNE_2001,
                    feature.properties.PNE_2002,
                    feature.properties.PNE_2003,
                    feature.properties.PNE_2004,
                    feature.properties.PNE_2005,
                    feature.properties.PNE_2006,
                    feature.properties.PNE_2007,
                    feature.properties.PNE_2008,
                    feature.properties.PNE_2009,
                    feature.properties.PNE_2010,
                    feature.properties.PNE_2011,
                    feature.properties.PNE_2012,
                    feature.properties.PNE_2013,
                    feature.properties.PNE_2014,
                    feature.properties.PNE_2015,
                    feature.properties.PNE_2016,
                    feature.properties.PNE_2017,
                    feature.properties.PNE_2018,
                    feature.properties.PNE_2019,
                    feature.properties.PNE_2020,
                    feature.properties.PNE_2021,
                    feature.properties.PNE_2022,
                    feature.properties.PNE_2023   

                    //feature.properties.OTRO_ATTRIBUTO // Cambiar si es necesario
                ];
            }),
            columns: [
                
                { title: "Pozo" },
                { title: "Estado" },
                { title: "Acuífero" },
                { title: "Elev.Brocal" },
                { title: "1996" },
                { title: "1997" },
                { title: "1998" },
                { title: "1999" },
                { title: "2000" },
                { title: "2001" },
                { title: "2002" },
                { title: "2003" },
                { title: "2004" },
                { title: "2005" },
                { title: "2006" },
                { title: "2007" },
                { title: "2008" },
                { title: "2009" },
                { title: "2010" },
                { title: "2011" },
                { title: "2012" },
                { title: "2013" },
                { title: "2014" },
                { title: "2015" },
                { title: "2016" },
                { title: "2017" },
                { title: "2018" },
                { title: "2019" },
                { title: "2020" },
                { title: "2021" },
                { title: "2022" },
                { title: "2023" }


                //{ title: "Otro Atributo" } // Cambiar si es necesario
            ],
            dom: '<"top"lBf>rt<"bottom"ip><"clear">', // Ajuste de 'dom' para una mejor disposición
            buttons: [
                'csvHtml5',
                'excelHtml5'
            ],
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "Todos"]],
            pageLength: 10, // Número inicial de filas mostradas
            language: {
                "sProcessing":     "Procesando...",
                "sLengthMenu":     "Mostrar _MENU_ registros",
                "sZeroRecords":    "No se encontraron resultados",
                "sEmptyTable":     "Ningún dato disponible en esta tabla",
                "sInfo":           "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
                "sInfoEmpty":      "Mostrando registros del 0 al 0 de un total de 0 registros",
                "sInfoFiltered":   "(filtrado de un total de _MAX_ registros)",
                "sInfoPostFix":    "",
                "sSearch":         "Buscar:",
                "sUrl":            "",
                "sInfoThousands":  ",",
                "sLoadingRecords": "Cargando...",
                "oPaginate": {
                    "sFirst":    "Primero",
                    "sLast":     "Último",
                    "sNext":     "Siguiente",
                    "sPrevious": "Anterior"
                },
                "oAria": {
                    "sSortAscending":  ": Activar para ordenar la columna de manera ascendente",
                    "sSortDescending": ": Activar para ordenar la columna de manera descendente"
                },
                "buttons": {
                    "csv": "Exportar CSV",
                    "excel": "Exportar Excel"
                }
            }
            
        });
    }

    // Añadir el evento de clic en fila
    $('#data-table tbody').on('click', 'tr', function () {
        var data = $("#data-table").DataTable().row(this).data();
        var pozoNombre = data[0]; // Suponiendo que la primera columna tiene el nombre del pozo

        var feature = geojson.features.find(function(f) {
            return f.properties.NOMBRE_POZ === pozoNombre;
        });

        if (feature) {
            var layer = featureLayer.getLayers().find(function(layer) {
                return layer.id === pozoNombre;
            });

            if (layer) {
                map.setView(layer.getLatLng(), 12); // Zoom al pozo
                layer.openPopup();
            }
        }
    });
}

// Mapeo de nombres de atributos
var attributeNames = {
    "CLAVE_ACUI": "Clave",
    "ELEV_BROCA": "Elev.Brocal",
    "NOMBRE_POZ": "Pozo",
    "NOMBRE_EST": "Estado",
    "NOMBRE_ACU": "Acuífero",
    "CLAVE_ESTA": "Clave Entidad",
    "PNE_1996": "1996",
    "PNE_1997": "1997",
    "PNE_1998": "1998",
    "PNE_1999": "1999",
    "PNE_2000": "2000",
    "PNE_2001": "2001",
    "PNE_2002": "2002",
    "PNE_2003": "2003",
    "PNE_2004": "2004",
    "PNE_2005": "2005",
    "PNE_2006": "2006",
    "PNE_2007": "2007",
    "PNE_2008": "2008",
    "PNE_2009": "2009",
    "PNE_2010": "2010",
    "PNE_2011": "2011",
    "PNE_2012": "2012",
    "PNE_2013": "2013",
    "PNE_2014": "2014",
    "PNE_2015": "2015",
    "PNE_2016": "2016",
    "PNE_2017": "2017",
    "PNE_2018": "2018",
    "PNE_2019": "2019",
    "PNE_2020": "2020",
    "PNE_2021": "2021",
    "PNE_2022": "2022",
    "PNE_2023": "2023"
    // Agrega otros mapeos según sea necesario
    // "NOMBRE_ORIGINAL": "Nombre Deseado"
};
// Crear el contenido del PopUp
// Crear el contenido del PopUp
function createPopupContent(feature) {
    var content = '<b>' +'Pozo: ' + feature.properties.NOMBRE_POZ + '</b><br>';
    content += 'Estado: ' + feature.properties.NOMBRE_EST + '<br>';
    content += 'Acuífero: ' + feature.properties.NOMBRE_ACU + '<br>';
    Object.keys(feature.properties).forEach(function(key) {
        if (feature.properties[key] && key !== 'NOMBRE_POZ' && key !== 'NOMBRE_EST' && key !== 'NOMBRE_ACU') {
            var displayName = attributeNames[key] || key; // Usar el nombre mapeado o el original si no hay mapeo
            content += displayName + ': ' + feature.properties[key] + '<br>';
        }
    });
    return content;
}

// Event listeners
$("#estados").change(function() {
    buildAquifersDropdown();
    updateWellsLayer();
    buildTable();
});

$("#acuiferos").change(function() {
    updateWellsLayer();
    buildTable();
});

$(document).ready(function() {
    initializeMap();
    buildTable(); // Inicializar la tabla

    // Inicializar DataTable
    if (!$.fn.DataTable.isDataTable('#data-table')) {
        $("#data-table").DataTable();
    }
});
