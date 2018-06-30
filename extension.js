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

imports.gi.versions.Gdk = "3.0";
imports.gi.versions.St = "1.0";

const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gdk = imports.gi.Gdk;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Cairo = imports.cairo

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Convenience = Extension.imports.convenience;
const WorldCupClient = Extension.imports.wcapi.WorldCupClient;

const Gettext = imports.gettext.domain(Extension.uuid);
const _ = Gettext.gettext;

class Ateam extends St.BoxLayout{
    constructor(tname=null, ticon_name=null){
        super({vertical: true,
               y_align: Clutter.ActorAlign.CENTER,
               x_align: Clutter.ActorAlign.CENTER});

        this.team_name = new St.Label({text: tname,
                                       y_align: Clutter.ActorAlign.CENTER,
                                       x_align: Clutter.ActorAlign.CENTER,
                                       style_class: 'team_name'});
        this.add(this.team_name);

        this.team_icon = new St.Icon({icon_name: ticon_name,
                                      icon_size: 48,
                                      y_align: Clutter.ActorAlign.CENTER,
                                      x_align: Clutter.ActorAlign.CENTER});
        this.add(this.team_icon);
    }
}

class Match extends St.BoxLayout{
    constructor(data=null){
        super({vertical: true,
               style_class: 'match',
               y_align: Clutter.ActorAlign.CENTER,
               x_align: Clutter.ActorAlign.CENTER});

        this.venue = new St.Label({text: data['venue'],
                                   style_class: 'venue',
                                   y_align: Clutter.ActorAlign.CENTER,
                                   x_align: Clutter.ActorAlign.CENTER});
        this.add(this.venue);

        let hbox = new St.BoxLayout({vertical: false,
                                     y_align: Clutter.ActorAlign.CENTER,
                                     x_align: Clutter.ActorAlign.CENTER});
        this.home_team = new Ateam(data['home_team']['country'],
                                   data['home_team']['code']);
        hbox.add(this.home_team);

        hbox.add(new St.Label({
            text: '%s - %s'.format(data['home_team']['goals'].toString(),
                                   data['away_team']['goals'].toString()),
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'goals'
        }));

        this.away_team = new Ateam(data['away_team']['country'],
                                   data['away_team']['code']);
        hbox.add(this.away_team);
        this.add(hbox);

        if(data['time']){
            this.match_time = new St.Label({text: data['time'].toString(),
                                            y_align: Clutter.ActorAlign.CENTER,
                                            x_align: Clutter.ActorAlign.CENTER});
        }else{
            let ttime = new Date(data['datetime']);
            ttime = new Date(ttime.getTime() - ttime.getTimezoneOffset()*60*1000);
            ttime = ttime.toISOString().substr(11,5);
            this.match_time = new St.Label({text: ttime,
                                            y_align: Clutter.ActorAlign.CENTER,
                                            x_align: Clutter.ActorAlign.CENTER});
        }
        this.add(this.match_time);
    }
}

class WorldCupIndicator extends PanelMenu.Button{
    constructor(){
        super(St.Align.START);
        this._settings = Convenience.getSettings();
        Gtk.IconTheme.get_default().append_search_path(
            Extension.dir.get_child('icons').get_path());

        let box = new St.BoxLayout();

        let icon = new St.Icon({ icon_name: 'world-cup-indicator-gs',
                                 style_class: 'system-status-icon' });
        box.add(icon);
        this.actor.add_child(box);

        this.current_match_section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.current_match_section);

        this.today_matches_section = new PopupMenu.PopupSubMenuMenuItem(_('Today\'s matches'));
        this.today_matches_section.actor.hide();
        this.menu.addMenuItem(this.today_matches_section);

        this.tomorrow_matches_section = new PopupMenu.PopupSubMenuMenuItem(_('Tomorrow\'s matches'));
        this.tomorrow_matches_section.actor.hide();
        this.menu.addMenuItem(this.tomorrow_matches_section);

        this.yesterday_matches_section = new PopupMenu.PopupSubMenuMenuItem(_('Yesterday\'s matches'));
        this.yesterday_matches_section.actor.hide();
        this.menu.addMenuItem(this.yesterday_matches_section);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let settingsMenuItem = new PopupMenu.PopupMenuItem(_("About"));
        settingsMenuItem.connect('activate', () => {
            GLib.spawn_command_line_async(
                "gnome-shell-extension-prefs world-cup-indicator-gs@atareao.es"
            );
        });
        this.menu.addMenuItem(settingsMenuItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addMenuItem(this._get_help());

        this.worldCupClient = new WorldCupClient();

        let ahora = new Date();
        this.when_today_updated = ahora;
        this.when_otherday_updated = ahora;

        this.updater(true);

        this.sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
                                                 60, // every minute
                                                 this.updater.bind(this));
    }

    updater(force=false){
        let ahora = new Date();
        this.updateCurrent();
        if(force || ahora - this.when_today_updated > 300) {
            this.when_today_updated = ahora;
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
                                     5,
                                     ()=>{
                                        this.updateToday();
                                        return false;
                                    });
        }
        if(force || ahora.getDay() != this.when_otherday_updated.getDay()) {
            this.when_otherday_updated = ahora;
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
                                     10,
                                     ()=>{
                                        this.updateTomorrow();
                                        return false;
                                    });
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
                                     15,
                                     ()=>{
                                        this.updateYesterday();
                                        return false;
                                    });
        }
        return true;
    }

    updateYesterday(){
        if(this.yesterday_matches_section.menu.numMenuItems > 0){
            this.yesterday_matches_section.menu.removeAll();
        }
        this.worldCupClient.get_yesterday_matches((message, result)=>{
            let presult = JSON.parse(result);
            if(this.yesterday_matches_section.menu.numMenuItems > 0){
                this.yesterday_matches_section.menu.removeAll();
            }
            if(presult.length > 0){
                this.yesterday_matches_section.actor.show();
                for(let amatch=0; amatch<presult.length; amatch++){
                    let item = new PopupMenu.PopupBaseMenuItem({
                        can_focus: false,
                        reactive: false
                    });
                    item.actor.add_actor(new Match(presult[amatch]));
                    this.yesterday_matches_section.menu.addMenuItem(item);
                }
            }else{
                this.yesterday_matches_section.actor.hide();
            }
        });
        return true;
    }

    updateCurrent(){
        this.worldCupClient.get_current_match((message, result)=>{
            let presult = JSON.parse(result);
            if(this.current_match_section.numMenuItems > 0){
                this.current_match_section.removeAll();
            }
            if(presult.length > 0){
                this.current_match_section.actor.show();
                for(let amatch=0; amatch<presult.length; amatch++){
                    let item = new PopupMenu.PopupBaseMenuItem({
                        can_focus: false,
                        reactive: false
                    });
                    item.actor.add_actor(new Match(presult[amatch]));
                    this.current_match_section.addMenuItem(item);
                }
            }else{
                this.current_match_section.actor.hide();
            }
        });
        return true;
    }

    updateToday(){
        this.worldCupClient.get_today_matches((message, result)=>{
            let presult = JSON.parse(result);

            if(this.today_matches_section.menu.numMenuItems > 0){
                this.today_matches_section.menu.removeAll();
            }
            if(presult.length > 0){
                this.today_matches_section.actor.show();
                for(let amatch=0; amatch<presult.length; amatch++){
                    let item = new PopupMenu.PopupBaseMenuItem({
                        can_focus: false,
                        reactive: false
                    });
                    item.actor.add_actor(new Match(presult[amatch]));
                    this.today_matches_section.menu.addMenuItem(item);
                }
            }else{
                this.today_matches_section.actor.hide();
            }
        });
        return true;
    }

    updateTomorrow(){
        this.worldCupClient.get_tomorrow_matches((message, result)=>{
            let presult = JSON.parse(result);

            if(this.tomorrow_matches_section.menu.numMenuItems > 0){
                this.tomorrow_matches_section.menu.removeAll();
            }
            if(presult.length > 0){
                this.tomorrow_matches_section.actor.show();
                for(let amatch=0; amatch<presult.length; amatch++){
                    let item = new PopupMenu.PopupBaseMenuItem({
                        can_focus: false,
                        reactive: false
                    });
                    item.actor.add_actor(new Match(presult[amatch]));
                    this.tomorrow_matches_section.menu.addMenuItem(item);
                }
            }else{
                this.tomorrow_matches_section.actor.hide();
            }
        });
        return true;
    }

    _create_help_menu_item(text, icon_name, url){
        let menu_item = new PopupMenu.PopupImageMenuItem(text, icon_name);
        menu_item.connect('activate', () => {
            Gio.app_info_launch_default_for_uri(url, null);
        });
        return menu_item;
    }

    _get_help(){
        let menu_help = new PopupMenu.PopupSubMenuMenuItem(_('Help'));
        menu_help.menu.addMenuItem(this._create_help_menu_item(
            _('Project Page'), 'github', 'https://github.com/atareao/world-cup-indicator-gs'));
        menu_help.menu.addMenuItem(this._create_help_menu_item(
            _('Get help online...'), 'help-online', 'https://www.atareao.es/aplicacion/el-mundial-en-ubuntu/'));
        menu_help.menu.addMenuItem(this._create_help_menu_item(
            _('Report a bug...'), 'bug', 'https://github.com/atareao/world-cup-indicator-gs/issues'));
        menu_help.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu_help.menu.addMenuItem(this._create_help_menu_item(
            _('El atareao'), 'web', 'https://www.atareao.es'));
        menu_help.menu.addMenuItem(this._create_help_menu_item(
            _('Follow me in Twitter'), 'twitter', 'https://twitter.com/atareao'));
        menu_help.menu.addMenuItem(this._create_help_menu_item(
            _('Follow me in Facebook'), 'facebook', 'http://www.facebook.com/elatareao'));
        menu_help.menu.addMenuItem(this._create_help_menu_item(
            _('Follow me in Google+'), 'google', 'https://plus.google.com/118214486317320563625/posts'));
        return menu_help;
    }
}

let worldCupIndicator;

function init(){
    Convenience.initTranslations();
}

function enable(){
    worldCupIndicator = new WorldCupIndicator();
    Main.panel.addToStatusArea('WorldCupIndicator',
                               worldCupIndicator,
                               0,
                               'right');
}

function disable() {
    GLib.source_remove(this.sourceId);
    worldCupIndicator.destroy();
}
