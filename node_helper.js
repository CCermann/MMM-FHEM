'use strict';

/* Magic Mirror
 * Module: MMM-FHEM
 *
 * By Benjamin Roesner http://benjaminroesner.com
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
var request = require('request');
var _ = require('underscore');

module.exports = NodeHelper.create({
    start: function () {
        this.config = {};
    },

    buildFhemUrl: function (config) {
        var deviceString = '';
        var csrf_token_full = '';
        if (config.csrf_token.trim()) {
            csrf_token_full = '&fwcsrf=' + config.csrf_token;
        }
        config.devices.forEach(function (element, index, array) {
            deviceString += element.deviceName + ',';
        });
        if (config.https) {
            return 'https://' + config.host + ':' + config.port + '/fhem?cmd=jsonlist2%20NAME=' + deviceString + '&XHR=1' + csrf_token_full;
        } else {
            return 'http://' + config.host + ':' + config.port + '/fhem?cmd=jsonlist2%20NAME=' + deviceString + '&XHR=1' + csrf_token_full;
        }
    },

    getFhemJson: function (config, callback) {
        request({
            url: this.buildFhemUrl(config),
            json: true,
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                callback(body);
            }
        });
    },

    /**
     * use fhem alias as label if it is set
     * @param  {object} device fhem device object
     * @return {string}
     */
    getDeviceName: function (device) {
        if (device.Attributes.alias) {
            return device.Attributes.alias;
        } else {
            return device.Name;
        }
    },

    getReadingsValue: function (deviceReadings_, device) {
        var values = [];

        deviceReadings_.forEach(function (element) {
            if (device.Readings[element]) {
                values.push(device.Readings[element].Value);
            } else {
                values.push('Reading not exist: ' +element  );
            }
        });

        return values;
    },
    //returns DeviceReadingsicon from config
    getConfigDeviceIcons: function (readingsName, configNames) {
        var self = this;
        var icon = [];
        var readingName = JSON.stringify(readingsName);
        configNames.forEach(function (element, index, array) {
            if (readingName.slice(1, -1) == element) {
                icon = (_.pluck(self.config.devices[index].deviceReadings, 'icon'));
            } else if (readingName.slice(1, -1).includes(element.slice(0, -1))) {
                icon = (_.pluck(self.config.devices[index].deviceReadings, 'icon'));
            }
        });
        return icon;
    },
    //returns getConfigDeviceHideValues from config
        getConfigDeviceHideValue: function (readingsName, configNames) {
        var self = this;
        var hide_value = [];
        var readingName = JSON.stringify(readingsName);
        configNames.forEach(function (element, index, array) {
            if (readingName.slice(1, -1) == element) {
                hide_value = (_.pluck(self.config.devices[index].deviceReadings, 'hide_value'));
            } else if (readingName.slice(1, -1).includes(element.slice(0, -1))) {
                hide_value = (_.pluck(self.config.devices[index].deviceReadings, 'hide_value'));
            }
        });
        return hide_value;
    },
    //returns getConfigDeviceReadings from config
    getConfigDeviceReadings: function (readingsName, configNames) {
        var self = this;
        var values = [];
            var readingName = JSON.stringify(readingsName);
            configNames.forEach(function (element, index, array) {
                if (readingName.slice(1, -1) == element ) {
                    values = (_.pluck(self.config.devices[index].deviceReadings, 'name'));
                } else if ( readingName.slice(1, -1).includes(element.slice(0,-1)) ) {
                    values = (_.pluck(self.config.devices[index].deviceReadings, 'name'));
                }
            });
        return values;
    },
    parseJson: function (json) {
        var self = this;
        var parsedJson = [];
        var resultsArray = json.Results;


        resultsArray.forEach(function (element, index, array) {
            //console.log("element: " + index + " " + JSON.stringify(element));
            var device = {};
            var configNames = _.pluck(self.config.devices, 'deviceName');

            var readingsName = self.getConfigDeviceReadings(element.Name, configNames, this);
            var hide_value = self.getConfigDeviceHideValue(element.Name, configNames, this);
            // save value of property 'name' an array

            //get the DeviceName or if exist the Alias from request
            device.name = self.getDeviceName(element);
            device.values = self.getReadingsValue(readingsName, element);
            device.icons = self.getConfigDeviceIcons(element.Name, configNames, this);
            if(! _.contains(device.values, hide_value.toString())) {
                parsedJson.push(device);
            }
        });

        return parsedJson;
    },

    // Subclass socketNotificationReceived received.
    socketNotificationReceived: function (notification, payload) {
        if (notification === 'GETDATA') {
            var self = this;
            self.config = payload;
            this.getFhemJson(this.config, function (data) {
                var structuredData = self.parseJson(data);
                self.sendSocketNotification('DATARECEIVED', structuredData);
            });
        }
    }

});
