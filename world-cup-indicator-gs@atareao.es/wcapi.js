/*
 * World Cup Indicator for GNOME Shell
 * The World Cup in your desktop
  *
 * Copyright (C) 2018
 *     Lorenzo Carbonell <lorenzo.carbonell.cerezo@gmail.com>,
 *
 * This file is part of Disk Space Usage.
 * 
 * WordReference Search Provider is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * WordReference Search Provider is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-extension-openweather.
 * If not, see <http://www.gnu.org/licenses/>.
 *
 */
 
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
//const Extension = imports.misc.extensionUtils.getCurrentExtension();
//const Convenience = Extension.imports.convenience;

const PROTOCOL = 'http';
const BASE_URL = 'worldcup.sfg.io';
const USER_AGENT = 'GNOME Shell - World-Cup-Indicator-GS - extension';
const HTTP_TIMEOUT = 10;

var formatDate = function (formatDate, formatString) {
    if(formatDate instanceof Date) {
        var months = new Array("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec");
        var yyyy = formatDate.getFullYear();
        var yy = yyyy.toString().substring(2);
        var m = formatDate.getMonth() + 1;
        var mm = m < 10 ? "0" + m : m;
        var mmm = months[m];
        var d = formatDate.getDate();
        var dd = d < 10 ? "0" + d : d;
        var h = formatDate.getHours();
        var hh = h < 10 ? "0" + h : h;
        var n = formatDate.getMinutes();
        var nn = n < 10 ? "0" + n : n;
        var s = formatDate.getSeconds();
        var ss = s < 10 ? "0" + s : s;

        formatString = formatString.replace(/yyyy/i, yyyy);
        formatString = formatString.replace(/yy/i, yy);
        formatString = formatString.replace(/mmm/i, mmm);
        formatString = formatString.replace(/mm/i, mm);
        formatString = formatString.replace(/m/i, m);
        formatString = formatString.replace(/dd/i, dd);
        formatString = formatString.replace(/d/i, d);
        formatString = formatString.replace(/hh/i, hh);
        formatString = formatString.replace(/h/i, h);
        formatString = formatString.replace(/nn/i, nn);
        formatString = formatString.replace(/n/i, n);
        formatString = formatString.replace(/ss/i, ss);
        formatString = formatString.replace(/s/i, s);
        return formatString;
    } else {
        return "";
    }
}


class WorldCupClient{
    constructor(params){
        this._protocol = PROTOCOL;
        this._base_url = BASE_URL;
    }

    _build_query_url(endpoint){
        let url = '%s://%s/%s/'.format(
            this._protocol,
            this._base_url,
            endpoint
        );
        return url;
    }

    _build_current_match_url(){
        return this._build_query_url('matches/current')
    }

    _build_matches_url_for(adate){
        let adatestr = formatDate(adate, 'YYYY-mm-dd');
        return this._build_query_url('matches?start_date=%s&end_date=%s'.format(
            adatestr, adatestr));
    }
    _build_today_matches_url(){
        let adate = new Date();
        return this._build_matches_url_for(adate);
    }

    _build_tomorrow_matches_url(){
        let adate = new Date();
        adate.setDate(adate.getDate()+1);
        return this._build_matches_url_for(adate);
    }

    _build_yesterday_matches_url(){
        let adate = new Date();
        adate.setDate(adate.getDate()-1);
        return this._build_matches_url_for(adate);
    }

    get_current_match(callback){
        this._get(callback, this._build_current_match_url());
    }

    get_today_matches(callback){
        this._get(callback, this._build_today_matches_url());
    }

    get_tomorrow_matches(callback){
        this._get(callback, this._build_tomorrow_matches_url());
    }

    get_yesterday_matches(callback){
        this._get(callback, this._build_yesterday_matches_url());
    }

    _get(callback, query_url) {
        log('XXXX ' + query_url);
        let request = Soup.Message.new('GET', query_url);
        _get_soup_session().queue_message(request,
            (http_session, message) => {
                print(1);
                if(message.status_code !== Soup.KnownStatusCode.OK) {
                    let error_message =
                        "WorldCupClient._get(): Error code: %s".format(
                            message.status_code
                        );
                    print(2);
                    callback(error_message, null);
                    return;
                }else{
                    let result = null;
                    print(3);
                    try {
                        result = request.response_body.data;
                        callback(null, result);
                    }catch(e) {
                        let message = "WorldCupClient._get(): %s".format(e);
                        callback(message, null);
                        return;
                    }
                }
            }
        );
        let message = "Nothing found";
        //callback(message, null);
    }
    destroy() {
        _get_soup_session().run_dispose();
        _SESSION = null;
    }

    get protocol() {
        return this._protocol;
    }

    set protocol(protocol) {
        this._protocol = protocol;
    }

    get base_url() {
        return this._base_url;
    }

    set base_url(url) {
        this._base_url = url;
    }
}

let _SESSION = null;

function _get_soup_session() {
    if(_SESSION === null) {
        _SESSION = new Soup.Session();
        Soup.Session.prototype.add_feature.call(
            _SESSION,
            new Soup.ProxyResolverDefault()
        );
        _SESSION.user_agent = USER_AGENT;
        _SESSION.timeout = HTTP_TIMEOUT;
    }

    return _SESSION;
}
let hoy = new Date();
print(hoy);
print(formatDate(hoy, 'YYYY-mm-dd'));