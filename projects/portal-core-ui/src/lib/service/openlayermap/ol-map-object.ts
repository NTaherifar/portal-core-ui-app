import {RenderStatusService} from '../cesium-map/renderstatus/render-status.service';
import {Constants, GeometryType } from '../../utility/constants.service';
import { UtilitiesService } from '../../utility/utilities.service';
import {Injectable , Inject} from '@angular/core';
import olMap from 'ol/Map';
import olTile from 'ol/layer/Tile';
import olOSM from 'ol/source/OSM';
import olView from 'ol/View';
import olLayer from 'ol/layer/Layer';
import olSourceVector from 'ol/source/Vector';
import olFormatGML2 from 'ol/format/GML2';
import olLayerVector from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';
import olGeomPolygon from 'ol/geom/Polygon';
import { fromExtent } from 'ol/geom/Polygon';
import BingMaps from 'ol/source/BingMaps';
import olDraw, { createBox } from 'ol/interaction/Draw';
import olControl from 'ol/control';
import olStyleStyle from 'ol/style/Style';
import olStyleCircle from 'ol/style/Circle';
import olStyleFill from 'ol/style/Fill';
import olStyleStroke from 'ol/style/Stroke';
import olGeomPoint from 'ol/geom/Point';
import olFeature from 'ol/Feature';
import * as olExtent from 'ol/extent';
import * as olEasing from 'ol/easing';
import {unByKey} from 'ol/Observable';
import { Subject , BehaviorSubject} from 'rxjs';
import * as G from 'ol-geocoder';
import {getVectorContext} from 'ol/render';

export interface BaseMapLayerOption {
  value: string;
  viewValue: string;
  layerType: string;
}



/**
 * A wrapper around the openlayer object for use in the map layer preview
 */
@Injectable()
export class OlMapObject {

  private map: olMap;
  private groupLayer: {};
  private clickHandlerList: ((p: any) => void )[] = [];
  private ignoreMapClick = false;
  private baseLayers = [];
  private baseMapLayers = [{ value: 'OSM', viewValue: 'OpenStreetMap', layerType: 'OSM' }];

  constructor(private renderStatusService: RenderStatusService, @Inject('env') private env) {
    if (env !== null) {
      this.baseMapLayers = env.baseMapLayers;
    }
    for (let i = 0; i < this.baseMapLayers.length; ++i) {
      if ( this.baseMapLayers[i].layerType === 'OSM') {
        this.baseLayers.push(new olTile({
          visible: true,
          source: new olOSM()
        }));
      } else if ( this.baseMapLayers[i].layerType === 'Bing') {
        this.baseLayers.push(new TileLayer({
          visible: false,
          preload: Infinity,
          source: new BingMaps({
            key: 'AgfoWboIfoy68Vu38c2RE83rEEuvWKjQWV37g7stRUAPcDiGALCEKHefrDyWn1zM',
            imagerySet: this.baseMapLayers[i].value,
            // use maxZoom 19 to see stretched tiles instead of the BingMaps
            // "no photos at this zoom level" tiles
             maxZoom: 19
          })
        }));
      } else if (this.baseMapLayers[i].layerType === 'ESRI') {
        this.baseLayers.push(new TileLayer({
          visible: false,
          preload: Infinity,
          source: new XYZ({
            attributions: 'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/' + this.baseMapLayers[i].value + '/MapServer">ArcGIS</a>',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/' + this.baseMapLayers[i].value + '/MapServer/tile/{z}/{y}/{x}',
            maxZoom: 18
          })
        }));
      } else if (this.baseMapLayers[i].layerType === 'Google') {
        this.baseLayers.push(new TileLayer({
          visible: false,
          preload: Infinity,
          source: new XYZ({
            url: 'http://mt1.google.com/vt/lyrs=' + this.baseMapLayers[i].value + '&x={x}&y={y}&z={z}'
          })
        }));
      }
    }
    this.groupLayer = {};
    this.map = new olMap({
      controls: [],
      layers: this.baseLayers,
      view: new olView({
        center: Constants.CENTRE_COORD,
        zoom: 4
      })
    });
    const me = this;

    // Call a list of functions when the map is clicked on
    this.map.on('click', function(evt) {
      if (me.ignoreMapClick) {
        return;
      }
      const pixel = me.map.getEventPixel(evt.originalEvent);
      for (const clickHandler of me.clickHandlerList) {
        clickHandler(pixel);
      }
    });

  }

  public addGeocoderToMap() {
    // Added ol-geocoder controller into map.
    const GC = new  G('nominatim', {
      provider: 'bing',
      key: 'AgfoWboIfoy68Vu38c2RE83rEEuvWKjQWV37g7stRUAPcDiGALCEKHefrDyWn1zM',
      lang: 'en',
      placeholder: 'search',
      limit: 5,
      autoComplete: true,
      keepOpen: true
    });
    const geocoderSource = GC.getSource();
    const me = this;
    GC.on('addresschosen', function (evt) {
      const coord = evt.coordinate;
      if (coord) {
        geocoderSource.clear();
        geocoderSource.addFeature(evt.feature); // add only the last one
        me.map.getView().setCenter(coord);
        me.map.getView().setZoom(9);
      }
    });
    this.map.addControl(GC);
}

public switchBaseMap(newstyle: string): void {
    for (let i = 0; i < this.baseLayers.length; ++i) {
      this.baseLayers[i].setVisible(this.baseMapLayers[i].value === newstyle);
      if (this.baseMapLayers[i].value === 'World_Imagery' && newstyle === 'Reference/World_Boundaries_and_Places') {
        this.baseLayers[i].setVisible(true);
      }
    }

}

public addControlToMap(control: olControl) {
  this.map.addControl(control);
}

  /**
   * Register a click handler callback function which is called when there is a click event
   * @param clickHandler callback function, input parameter is the pixel coords that were clicked on
   */
  public registerClickHandler( clickHandler: (p: number[]) => void) {
      this.clickHandlerList.push(clickHandler);
  }

  /**
   * returns an instance of the ol map
   */
  public getMap(): olMap {
    return this.map;
  }

  /**
   * Zoom the map in one level
   */
  public zoomIn(): void {
    this.map.getView().setZoom(this.map.getView().getZoom() + 1);
  }

  /**
   * Zoom the map out one level
   */
  public zoomOut(): void {
    this.map.getView().setZoom(this.map.getView().getZoom() - 1);
  }

  /**
   * Add an ol layer to the ol map. At the same time keep a reference map of the layers
   * @param layer: the ol layer to add to map
   * @param id the layer id is used
   */
  public addLayerById(layer: olLayer, id: string): void {
    if (!this.groupLayer[id]) {
      this.groupLayer[id] = [];
    }
    // LJ:skip the polygon search for getFeatureInfo.
    if (layer.sldBody && layer.sldBody.indexOf('<ogc:Intersects>') >= 0)  {
      // RA: but retain the other filters
      const polygonFilter = UtilitiesService.getPolygonFilter(layer.sldBody);
      layer.sldBody = layer.sldBody.replace(polygonFilter, "");
    }
    this.groupLayer[id].push(layer);

    this.map.addLayer(layer);
  }


  /**
   * Retrieve references to the layer by layer name.
   * @param id the layer id is used
   * @return the ol layer
   */
  public getLayerById(id: string): [olLayer] {
    if (!this.groupLayer[id] || this.groupLayer[id].length === 0) {
      return null;
    }
    return this.groupLayer[id];
  }


  /**
   * Get all active layers
   */
  public getLayers(): { [id: string]: [olLayer]} {
    return this.groupLayer;
  }


  /**
   * remove references to the layer by layer id.
   * @param id the layer id is used
   */
  public removeLayerById(id: string) {
    const activelayers = this.getLayerById(id);
    if (activelayers) {
      activelayers.forEach(layer => {
        this.map.removeLayer(layer);
      });
      delete this.groupLayer[id];
    }
  }

  /**
   * Show/Hide the layer
   * @param layerId the ID of the layer to show/hide
   * @param visible if true, the layer will be visible, false will hide the layer
   */
  public setLayerVisibility(layerId: string, visible: boolean) {
    if (this.getLayerById(layerId) != null) {
        const layers: [olLayer] = this.getLayerById(layerId);
        for (const layer of layers) {
            layer.setVisible(visible);
        }
    }
  }

  /**
   * Set a layer's opacity
   *
   * @param layerId the ID of the layer to change opacity
   * @param opacity the value of opacity between 0.0 and 1.0
   */
  public setLayerOpacity(layerId: string, opacity: number) {
    if (this.getLayerById(layerId) != null) {
      const layers: [olLayer] = this.getLayerById(layerId);
      for (const layer of layers) {
        layer.setOpacity(opacity);
      }
    }
  }

  /**
   * Set or modify a layer's source parameter
   * @param param the source parameter name
   * @param value the new source parameter value
   */
  public setLayerSourceParam(layerId: string, param: string, value: any) {
  const activelayers = this.getLayerById(layerId);
    if (activelayers) {
      activelayers.forEach(layer => {
        layer.getSource().updateParams({[param]: value});
      });
    }
  }
  /**
  * Method for drawing a polygon shape on the map. e.g selecting a polygon bounding box on the map
  * @returns a observable object that triggers an event when the user complete the drawing
  */
  public drawPolygon(): BehaviorSubject<olLayerVector> {
    this.ignoreMapClick = true;
    const source = new olSourceVector({ wrapX: false });

    const vector = new olLayerVector({
      source: source
    });
    const vectorBS = new BehaviorSubject<olLayerVector>(vector);

    this.map.addLayer(vector);
    const draw = new olDraw({
      source: source,
      type: /** @type {ol.geom.GeometryType} */ ('Polygon')
    });
    const me = this;
    draw.on('drawend', function (e) {
      const coords = e.feature.getGeometry().getCoordinates()[0];
      e.feature.set('bClipboardVector', true, true);

      const coordString = coords.join(' ');
      vector.set('polygonString', coordString);
      vectorBS.next(vector);
      me.map.removeInteraction(draw);
      setTimeout(function() {
        me.ignoreMapClick = false;
      }, 500);
    });
    this.map.addInteraction(draw);
    return vectorBS;
  }

  public renderPolygon(polygon: any): BehaviorSubject<olLayerVector> {
    if (polygon.srs !== 'EPSG:3857') {
      return null;
    }
    let feature = null;
    if (polygon.geometryType === GeometryType.MULTIPOLYGON) {
      const gmlFormat = new olFormatGML2();
      const gml2 = polygon.raw;
      feature = gmlFormat.readFeatures(gml2, {featureProjection: 'EPSG:3857'})[0];
    } else {
      const coordsArray = polygon.coordinates.split(' ');
      const coords = [];
      for (const c of coordsArray) {
        coords.push(c.split(','));
      }
      const geom = new olGeomPolygon([coords]);
      feature = new olFeature({geometry: geom});
    }

    feature.set('bClipboardVector', true, true);
    const style = new olStyleStyle({
      fill: new olStyleFill({
        color: 'rgba(255, 255, 255, 0.6)'
      }),
      stroke: new olStyleStroke({
        color: '#319FD3',
        width: 1
      })
    });
    const vector = new olLayerVector({
        source: new olSourceVector({
          format: new olFormatGML2({
            srsName: 'EPSG::3857'
          }),
          features: [feature]
        }),
        style: style
    });
    const vectorBS = new BehaviorSubject<olLayerVector>(vector);
    this.map.addLayer(vector);
    return vectorBS;
  }

 /**
 * Method for drawing a box on the map. e.g selecting a bounding box on the map
 * @returns a observable object that triggers an event when the user complete the drawing
 */
  public drawBox(): Subject<olLayerVector> {
    this.ignoreMapClick = true;
    const source = new olSourceVector({wrapX: false});

    const vector = new olLayerVector({
      source: source
    });

    const vectorBS = new Subject<olLayerVector>();


    this.map.addLayer(vector);
    const draw = new olDraw({
      source: source,
      type: /** @type {ol.geom.GeometryType} */ ('Circle'),
      geometryFunction: createBox()
    });
    const me = this;
    draw.on('drawend', function() {
      me.map.removeInteraction(draw);
      setTimeout(function() {
        me.map.removeLayer(vector);
        vectorBS.next(vector);
        me.ignoreMapClick = false;
      }, 500);
    });
    this.map.addInteraction(draw);
    return vectorBS;
  }

  /**
    * Method for drawing a dot on the map.
    * @returns the layer vector on which the dot is drawn on. This provides a handle for the dot to be deleted
    */
  public drawDot(coord): olLayerVector {
    const source = new olSourceVector({wrapX: false});
    const vector = new olLayerVector({
      source: source,
      style: new olStyleStyle({
        fill: new olStyleFill({
          color: 'rgba(255, 255, 255, 0.2)'
        }),
        stroke: new olStyleStroke({
          color: '#ffcc33',
          width: 2
        }),
        image: new olStyleCircle({
          radius: 7,
          fill: new olStyleFill({
            color: '#ffcc33'
          })
        })
      })
    });

    this.map.addLayer(vector);
    const me = this;
    const geom = new olGeomPoint(coord);
    const feature = new olFeature(geom);
     function flash(feature) {
        const start = new Date().getTime();
        let listenerKey;

        function animate(event) {
          const vectorContext = getVectorContext(event);
          const frameState = event.frameState;
          const flashGeom = feature.getGeometry().clone();
          const elapsed = frameState.time - start;
          const elapsedRatio = elapsed / 3000;
          // radius will be 5 at start and 30 at end.
          const radius = olEasing.easeOut(elapsedRatio) * 25 + 5;
          const opacity = olEasing.easeOut(1 - elapsedRatio);

          const style = new olStyleStyle({
            image: new olStyleCircle({
              radius: radius,
              snapToPixel: false,
              stroke: new olStyleStroke({
                color: 'rgba(255, 0, 0, ' + opacity + ')',
                width: 0.25 + opacity
              })
            })
          });

          vectorContext.setStyle(style);
          vectorContext.drawGeometry(flashGeom);
          if (elapsed > 3000) {
            unByKey(listenerKey);
            return;
          }
          // tell OpenLayers to continue postcompose animation
          me.map.render();
        }
        listenerKey = vector.on('postrender', animate);
      }

      source.on('addfeature', function(e) {
        flash(e.feature);
      });
     source.addFeature(feature);

    return vector;
  }

  /**
   * Return the extent of the entire map
   * @returns an olExtent object representing the bounds of the map
   */
  public getMapExtent(): olExtent {
    return this.map.getView().calculateExtent(this.map.getSize());
  }

  /**
   * Display an extent for 3 seconds
   * @param extent the olExtent to display on the map
   * @param duration (Optional) the length of time in milliseconds to display the extent before it is removed. If not supplied the extent will not be removed.
   */
  public displayExtent(extent: olExtent, duration?: number): void {
    const poly: olGeomPolygon = fromExtent(extent);
    const feature: olFeature = new olFeature(poly);
    const source = new olSourceVector({wrapX: false});
    source.addFeature(feature);
    // TODO: Styling
    const vector = new olLayerVector({
      source: source
    });
    this.map.addLayer(vector);
    if (duration !== undefined && duration !== -1) {
        setTimeout(() => {
          this.removeVector(vector);
        }, duration);
    }
  }

  /**
   * Remove a vector from the map
   */
  public removeVector(vector: olLayerVector) {
    this.map.removeLayer(vector);
  }

  /**
   * get the current state of the map in a object containing the zoom and center
   * @returns a object containing {zoom, center}
   */
  public getCurrentMapState() {
    return {
      zoom: this.map.getView().getZoom(),
      center: this.map.getView().getCenter()
    };
  }


  /**
   * given the state of the map in a object, resume the map in the given state
   * @param the state of the map in the format {zoom, center}
   */
  public resumeMapState(mapState) {
    this.map.getView().setZoom(mapState.zoom);
    this.map.getView().setCenter(mapState.center);
  }

  /**
   * Call updateSize on the map to handle scale changes
   */
  public updateSize() {
    this.map.updateSize();
  }

}
