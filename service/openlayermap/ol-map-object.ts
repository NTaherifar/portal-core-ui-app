import {OnlineResourceModel} from '../../model/data/onlineresource.model';
import {RenderStatusService} from './renderstatus/render-status.service';
import {Constants} from '../../utility/constants.service';
import {Injectable, Inject} from '@angular/core';
import olMap from 'ol/map';
import olTile from 'ol/layer/tile';
import olOSM from 'ol/source/osm';
import olView from 'ol/view';
import olLayer from 'ol/layer/layer';
import olProj from 'ol/proj';
import olSourceVector from 'ol/source/vector';
import olLayerVector from 'ol/layer/vector';
import olGeomPolygon from 'ol/geom/polygon';
import olGeometry from 'ol/geom/geometry';
import olControlMousePosition from 'ol/control/mouseposition';
import olCoordinate from 'ol/coordinate';
import olDraw from 'ol/interaction/draw';
import olControl from 'ol/control';
import olStyleStyle from 'ol/style/style';
import olStyleCircle from 'ol/style/circle';
import olStyleFill from 'ol/style/fill';
import olStyleStroke from 'ol/style/stroke';
import olGeomPoint from 'ol/geom/point';
import olFeature from 'ol/feature';
import olEasing from 'ol/easing';
import olObservable from 'ol/observable';
import olExtent from 'ol/extent';
import { Subject } from 'rxjs/Subject';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';

/**
 * A wrapper around the openlayer object for use in the portal.
 */
@Injectable()
export class OlMapObject {
  private map: olMap;
  private activeLayer: {};
  private clickHandlerList: ((p: any) => void )[] = [];
  private ignoreMapClick = false;

  constructor(private renderStatusService: RenderStatusService) {

    const osm_layer: any = new olTile({
      source: new olOSM()
    });
    this.activeLayer = {};
    this.map = new olMap({
      controls: [],
      layers: [osm_layer],
      view: new olView({
        center: Constants.CENTRE_COORD,
        zoom: 4
      })
    });

    // Call a list of functions when the map is clicked on
    const me = this;
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
    if (!this.activeLayer[id]) {
      this.activeLayer[id] = [];
    }
    this.activeLayer[id].push(layer);

    this.map.addLayer(layer);
  }


  /**
   * Retrieve references to the layer by layer name.
   * @param id the layer id is used
   * @return the ol layer
   */
  public getLayerById(id: string): [olLayer] {
    if (!this.activeLayer[id] || this.activeLayer[id].length === 0) {
      return null;
    }
    return this.activeLayer[id];
  }


  /**
   * Get all active layers
   */
  public getLayers(): { [id: string]: [olLayer]} {
    return this.activeLayer;
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
      delete this.activeLayer[id];
      this.renderStatusService.resetLayer(id);
    }
  }
  
  /*
   *
   */
  public setLayerVisibility(layerId: string, visible: boolean) {
    if (this.getLayerById(layerId) != null) {
        let layers: [olLayer] = this.getLayerById(layerId);
        for(let layer of layers) {
            layer.setVisible(visible);
        }
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
      const coordString = coords.join(' ');
      vector.set('polygonString', coordString);
      vectorBS.next(vector);
      me.map.removeInteraction(draw);
    });
    this.map.addInteraction(draw);
    return vectorBS;
  }

  public renderPolygon(polygon: any): BehaviorSubject<olLayerVector> {
    if (polygon.srs !== 'EPSG:3857') {
      return null;
    }

    const coordsArray = polygon.coordinates.split(' ');
    const coords = [];
    for (const c of coordsArray) {
      coords.push(c.split(','));
    }
    const geom = new olGeomPolygon([coords]);
    const feature = new olFeature({geometry: geom})
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
      geometryFunction: olDraw.createBox()
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
          const vectorContext = event.vectorContext;
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
            olObservable.unByKey(listenerKey);
            return;
          }
          // tell OpenLayers to continue postcompose animation
          me.map.render();
        }
        listenerKey = me.map.on('postcompose', animate);
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
    const poly: olGeomPolygon = olGeomPolygon.fromExtent(extent);
    const feature: olFeature = new olFeature(poly);
    const source = new olSourceVector({wrapX: false});
    source.addFeature(feature);
    // TODO: Styling
    let vector = new olLayerVector({
      source: source
    });
    this.map.addLayer(vector);
    if(duration !== undefined && duration !== -1) {
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

}
