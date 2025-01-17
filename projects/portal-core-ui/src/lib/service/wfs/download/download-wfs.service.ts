
import { throwError as observableThrowError,  Observable } from 'rxjs';

import { catchError, map, timeoutWith } from 'rxjs/operators';
import { Bbox } from '../../../model/data/bbox.model';
import { LayerModel } from '../../../model/data/layer.model';
import { LayerHandlerService } from '../../cswrecords/layer-handler.service';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import * as $ from 'jquery';

declare var gtag: Function;

/**
 * Service to download WFS data
 */
// @dynamic
@Injectable()
export class DownloadWfsService {

  constructor(private layerHandlerService: LayerHandlerService, private http: HttpClient, @Inject('env') private env) {

  }

  /**
   * Download the layer
   * @param the layer to download
   * @param bbox the bounding box of the area to download
   */
  public download(layer: LayerModel, bbox: Bbox, polygonFilter: String): Observable<any> {

    try {
      const wfsResources = this.layerHandlerService.getWFSResource(layer);
      if (this.env.googleAnalyticsKey && typeof gtag === 'function') {
        gtag('event', 'CSVDownload',  {'event_category': 'CSVDownload', 'event_action': layer.id });
      }
      let downloadUrl = 'getAllFeaturesInCSV.do';
      if (layer.proxyDownloadUrl && layer.proxyDownloadUrl.length > 0) {
        downloadUrl = layer.proxyDownloadUrl;
      } else if (layer.proxyUrl && layer.proxyUrl.length > 0) {
        downloadUrl = layer.proxyUrl;
      }

      let httpParams = new HttpParams();
      httpParams = httpParams.set('outputFormat', 'csv');

      for (let i = 0; i < wfsResources.length; i++) {
        const filterParameters = {
          serviceUrl: wfsResources[i].url,
          typeName: wfsResources[i].name,
          maxFeatures: 10000,
          outputFormat: 'csv',
          bbox: bbox ? JSON.stringify(bbox) : '',
          filter: polygonFilter
        };

        const serviceUrl = this.env.portalBaseUrl + downloadUrl + '?';


        httpParams = httpParams.append('serviceUrls', serviceUrl + $.param(filterParameters));
      }

      return this.http.post(this.env.portalBaseUrl + 'downloadGMLAsZip.do', httpParams.toString(), {
        headers: new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded'), 
        responseType: 'blob'
      }).pipe(timeoutWith(360000, observableThrowError(new Error('Request have timeout out after 5 minutes'))),
        map((response) => { // download file
          return response;
	  }), catchError((error: HttpResponse<any>) => {
          return observableThrowError(error);
        }), );
    } catch (e) {
      return observableThrowError(e);
    }

  }
}
