import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as olProj from 'ol/proj';
import { CsMapObject } from './cs-map-object';
import { GeometryType } from '../../utility/constants.service';

/**
 * A wrapper around the clipboard object for use in the portal.
 */
@Injectable()
export class CsClipboardService {
  private polygonBBox: Polygon;
  public polygonsBS: BehaviorSubject<Polygon>;

  private bShowClipboard: Boolean = false;
  public clipboardBS = new BehaviorSubject<Boolean>(this.bShowClipboard);

  private bFilterLayers: Boolean = false;
  public filterLayersBS = new BehaviorSubject<Boolean>(this.bFilterLayers);

  constructor(private csMapObject: CsMapObject) {
    this.polygonBBox = null;
    this.polygonsBS = new BehaviorSubject<Polygon>(this.polygonBBox);
    this.polygonsBS.next(this.polygonBBox);
  }

  public toggleClipboard(open?: boolean) {
    if (open !== undefined) {
      this.bShowClipboard = open;
    } else {
      this.bShowClipboard = !this.bShowClipboard;
    }

    this.clipboardBS.next(this.bShowClipboard);
    // if no clipboard, recover the all layers list.
    if (!this.bShowClipboard) {
      this.bFilterLayers = false ;
      this.filterLayersBS.next(this.bFilterLayers );
    }
  }

  public toggleFilterLayers() {
    this.bFilterLayers = !this.bFilterLayers ;
    this.filterLayersBS.next(this.bFilterLayers );
  }

  public getGeometry(coords: String): any {
    const geometry = 
      '<gml:MultiPolygon srsName=\"urn:ogc:def:crs:EPSG::4326\">' +
        '<gml:polygonMember>' +
          '<gml:Polygon srsName=\"EPSG:4326\">' +
            '<gml:outerBoundaryIs>' +
              '<gml:LinearRing>' +
                '<gml:coordinates xmlns:gml=\"http://www.opengis.net/gml\" decimal=\".\" cs=\",\" ts=\" \">' +
                  coords +
                '</gml:coordinates>' +
              '</gml:LinearRing>' +
            '</gml:outerBoundaryIs>' +
          '</gml:Polygon>' +
        '</gml:polygonMember>' +
      '</gml:MultiPolygon>';
    return geometry;
  }
  /**
   * Method for drawing a polygon on the map.
   * @returns the polygon coordinates string BS on which the polygon is drawn on.
   */
  public drawPolygon() {
    this.csMapObject.drawPolygon().subscribe(
        (coords) => {
          const newPolygon = {
            name: 'manual-' + Math.floor(Math.random() * 1000),
            srs: 'EPSG:4326',
            geometryType: GeometryType.POLYGON,
            coordinates: this.getGeometry(coords)
          };
          this.polygonBBox = newPolygon;
          this.polygonsBS.next(this.polygonBBox);
      });
  }

  public addPolygon(newPolygon: Polygon) {
    if (this.polygonBBox !== null && this.polygonBBox.name === newPolygon.name) {
      return;
    }
    if (newPolygon.geometryType !== GeometryType.MULTIPOLYGON) {
      const coordsArray = newPolygon.coordinates.split(' ');
      const coords = [];
      // transform from 'EPSG:4326'to 'EPSG:3857' format
      for (let i = 0; i < coordsArray.length; i += 2) {
        // TODO: Get rid of olProj.transform
        const point = olProj.transform([parseFloat(coordsArray[i]), parseFloat(coordsArray[i + 1])], newPolygon.srs , 'EPSG:3857');
        coords.push({'x': point[0], 'y': point[1]});
      }
      newPolygon.srs = 'EPSG:3857';
      // make newPolygon
      const newPolygonString = coords.join(' ');
      newPolygon.coordinates = newPolygonString;
    }
    // save the newPolygon to polygonsBS
    this.polygonBBox = newPolygon;
    this.polygonsBS.next(this.polygonBBox);
    // show polygon on map
  }

  public removePolygon() {
    this.polygonsBS.next(this.polygonBBox);
  }

  public clearClipboard() {
    this.csMapObject.clearPolygon();
    this.polygonBBox = null;
    this.polygonsBS.next(this.polygonBBox);
  }
}

export interface Polygon {
  name: string;
  srs: string;
  geometryType: GeometryType;
  coordinates: string;
  raw?: string;
}
