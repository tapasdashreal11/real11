'use strict'
var moment = require('moment');
var Promise = require('bluebird'),
    EmailTemplate = require('email-templates').EmailTemplate,
    path = require('path'),
    logger = require('../utils/logger')(module);

var TEMPLATES_PATH = '../views/email-templates';

/**
*   name: emailTemplateGenerator
*   desc: generates email templates with custom data
*   type: function
*   @param[string]: 'templateName' //Name of the email template to generate
*   @param[object]: 'templateData' //Custom fields to be embedded to template
*   Example:
*        var templateData = { name: 'John Lee', email:'john.lee@gmail.com',
*            'referalink '
*        }
*       generateEmailTemplate('social-invitation', templateData)
*
*/

var emailTemplateGenerator = function(templateName, templateData = {}) {
    return new Promise(function(resolve, reject) {
        if (templateName === '' || typeof templateName === 'undefined') {
            return reject('No template name received')
        } else {
            templateData.moment = moment;
            getTemplatePath(templateName, templateData)
            .then(createTemplate)
            .then(function(template) {
                resolve(template);
            })
            .catch(function(error) {
                reject(`There was a problem generating email template. ErrorTrace: ${error}`)
            })
        }

    });
}


/**
*   name: createTemplate
*   desc: creates the template
*   type: function
*   @param[object]: template //template data {name, data, directory}
*/

var createTemplate = function(template) {
    return new Promise(function(resolve, reject) {
        var email = new EmailTemplate(template.directory);
        email.render(template.data, function (error, result) {
            if (error) { reject(`There was a error creating template. Error${error}`)}
            else { resolve(result)}
        })
    })
}


/**
*   name: getTemplatePath
*   desc: gets the template path from the templates directory
*   type: function
*   @param[string]: 'templateName' //name of email template on path
*   @param[object]: 'templateData' //fields data to be interpolated to html template
*/

var getTemplatePath = function(templateName, templateData) {
    return new Promise(function(resolve, reject) {
        if (templateName === '' || typeof templateName === 'undefined') {
            return reject('required Fields not reveived')
        }
        else {
            var templateDir = path.join(__dirname, TEMPLATES_PATH, templateName);
            if (templateDir !== '') {
                resolve({ name: templateName, data: templateData, directory:templateDir });
            } else {
                reject(`Unable to find template: ${templateName} on ${templateDir}`);
            }
        }
    })

}

/** 
*   name: validateTemplateFields
*   desc: validate template fields to match required keys from template
*   type: function
*   @param[object]: template //template data {name, data, directory}
*   @todo: Make validation dynamic
*/

var validateTemplateFields = function(template) {
    //default templates custom data keys
    /*
    * All new templates keys for custom data should be added here
    */
    var SOCIAL_INVITATION_KEYS = ['registrationLink', 'customUserMessage'];

    return new Promise(function(resolve, reject) {
        if (template.name === '' || template.name === 'undefined' ||
           (template.data === '' || template.data === "undefined")) {
             reject('required Fields not reveived')
        }

        //To add new templates cases validation, just add a new swith statement
        //case with the template name.
        switch (template.name) {
            case 'email-invitation':
                if(hasValidProperties(template.data, SOCIAL_INVITATION_KEYS)) {
                    resolve({name: template.name, data: template.data, directory:template.directory})
                } else {
                    reject('Invalid or no fields received for social-invitation template')
                }
                break;
            default:

                reject (`Invalid template name: ${template.name}.Verify template data
                        matches the names on email templates directory`);
        }
    })
}

/** 
*   name: hasValidProperties
*   desc: checks if the given object properties names match all the keys in the given keysArrays
*   type: function
*   @param[object]:objectData
*   @param[array]: keysArray
*
*/

var hasValidProperties = function(objectData, keysArray) {
    var matchingKeys = [];
    if (keysArray && objectData) {
        matchingKeys = Object.getOwnPropertyNames(objectData).map(function(objName) {
            return keysArray.map(function(key) {
                if(key === objName) {
                    return key;
                }
            })
        })
    }
    return matchingKeys.length === keysArray.length;
}

module.exports.emailTemplateGenerator = emailTemplateGenerator;
