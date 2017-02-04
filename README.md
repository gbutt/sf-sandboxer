# Salesforce Sandbox Data Loader

This is a simple utility that will help you populate a Salesforce org with data from another org. It is very useful for loading data from production to a sandbox for development.

## Install

`npm install sf-sandboxer`

## Usage

Display help:
`sandboxer help`

Run a config:
`sandboxer -p CorrectHorseBatteryStaple -c configs/sample.json`

## Config spec
- *src* - username and loginUrl for the source org
- *dest* - username and loginUrl for the destination org
- *variables* - variables can be injected into SOQL filters: i.e. "MY_HOMIES" : "'Halliburton','KFC'" will replace all occurences of $MY_HOMIES in a filter.
- *preLoad* - dymanically create a variable from the source org using a SOQL query.
- *loaders* - a list of data loaders to execute in order. Data loaders will query the fields from the source org and load them into the destination org.


### Loaders
- *type* - the type of object to load
- *enabled* - true to run this loader
- *operation* - type of operation to perform in the dest org. (insert, update, upsert)
- *options* - options to pass to the upsert command (extIdField is the most common)
- *filter* - where clause to append to the source SOQL query
- *fields* - list of fields to query from the source org and load into the destination org. NOTE - You can link child object to parents using an external ID. For example you can associate a Contact to an Account by including Account.Name.
- *mappings* - transformations to apply to the data before loading into the destination org


### Mappings
- *srcField* - name of the source field to map into a destination field (i.e. convert Name into Description)
- *destField* - name of the target field
- *srcValue* - a static value or variable to use in place for a queried field.
- *removeSrcField* - whether or not to remove the src field from the object before loading. (i.e. we don't want to load the Contact's Name field into the destination org because it will cause a load failure)

## Sample Config
``` json
{
    "src" : {
        "username": "donald@trump.biz",
        "loginUrl": "https://login.salesforce.com"
    },
    "dest" : {
        "username": "donald@trump.biz.fired",
        "loginUrl": "https://test.salesforce.com"
    },
    "variables": {
        "MY_HOMIES": "'Halliburton','Comcast','KFC','Fox'"
    },
    "preLoad" : {
        "THE_DONALD": "SELECT Id FROM User WHERE Username = 'donald@trump.biz'"
    },
    "loaders": [
        {   "type": "Account",
            "enabled": true,
            "operation": "upsert",
            "options": {
                "extIdField": "Name"
            },
            "filter": "Name IN ($MY_HOMIES)",
            "fields": [
                "Name",
                "AccountNumber",
                "Site"
            ],
            "mappings": [{
                "srcValue": "$THE_DONALD",
                "destField": "OwnerId"
            }]
        },
        {   "type": "Contact",
            "enabled": true,
            "operation": "upsert",
            "options": {
                "extIdField": "Email"
            },
            "filter": "Account.Name IN ($MY_HOMIES)",
            "fields": [
                "FirstName",
                "LastName",
                "Account.Name",
                "AssistantName",
                "AssistantPhone",
                "Birthdate",
                "Department"
            ],
            "mappings": [{
                "srcField": "ID",
                "destField": "Description"
            }]
        }
    ]
}
```