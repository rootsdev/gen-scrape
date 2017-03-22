var debug = require('debug')('genscrape:scrapers:myheritage-record'),
    utils = require('../utils'),
    GedcomX = require('gedcomx-js'),
    HorizontalTable = require('../HorizontalTable'),
    VerticalTable = require('../VerticalTable');

var urls = [
  utils.urlPatternToRegex('https://www.myheritage.com/research/record-*')
];

var events = [
  {
    regex: /^birth$/,
    type: 'http://gedcomx.org/Birth'
  },
  {
    regex: /^christening$/,
    type: 'http://gedcomx.org/Christening'
  },
  {
    regex: /^marriage$/,
    type: 'http://gedcomx.org/Marriage'
  },
  {
    regex: /^immigration$/,
    type: 'http://gedcomx.org/Immigration'
  },
  {
    regex: /^residence$/,
    type: 'http://gedcomx.org/Residence'
  },
  {
    regex: /^death$/,
    type: 'http://gedcomx.org/Death'
  },
  {
    regex: /^burial$/,
    type: 'http://gedcomx.org/Burial'
  }
];

module.exports = function(register){
  register(urls, setup);
};

function setup(emitter) {
  debug('run');

  var gedx = new GedcomX();

  // Create/add the primary person
  var primaryPerson = new GedcomX.Person({
    id: getRecordId(document.location.href),
    principal: true,
    identifiers: {
      'genscrape': getRecordIdentifier(document.location.href)
    }
  });
  gedx.addPerson(primaryPerson);

  // Name
  var name = document.querySelector('.recordTitle').textContent
  primaryPerson.addSimpleName(name);

  var table = new HorizontalTable(document.querySelector('.recordFieldsTable'), {
    rowSelector: 'tbody > tr',
    labelMapper: function(label) {
      return label.toLowerCase().replace(/:$/,'');
    }
  });

  // Gender
  if(table.hasMatch(/gender/)) {
    var genderType = getGender(table.getMatchText(/gender/));
    if(genderType){
      primaryPerson.setGender({
        type: genderType
      });
    }
  }

  // Other Names
  if(table.hasMatch(/birth names/)) {
    var rawNames = table.getMatch(/birth names/).innerHTML;
    var names = rawNames.split(/<br ?\/?>/);

    for (var str of names) {
      var name = GedcomX.Name.createFromString(str);
      if (!primaryPerson.hasName(name)) {
        primaryPerson.addName(name);
      }
    }
  }


  // Events
  events.forEach(function(event) {
    if(table.hasMatch(event.regex)) {
      var cell = table.getMatch(event.regex);
      // Linked places have extra stuff we need to ignore
      var place = cell.querySelector('.event_place .map_callout_link');
      // If it's not a linked place, just get the content
      if (!place) {
        place = cell.querySelector('.event_place');
      }
      var date = cell.querySelector('.event_date');
      if (place || date) {
        var fact = GedcomX.Fact({
          type: event.type
        });
        if (date) {
          fact.setDate({
            original: date.textContent.trim()
          });
        }
        if (place) {
          fact.setPlace({
            original: place.textContent.trim()
          });
        }
        primaryPerson.addFact(fact);
      }
    }
  });

  // Mother/Father
  if(table.hasMatch(/(father|mother)/)){
    var name = table.getMatchText(/(father|mother)/);
    gedx.addRelativeFromName(primaryPerson, name, 'Parent');
  }

  // Additional Tables
  var tables = document.querySelectorAll('.recordFieldsTable');
  // Reminder: tables is a NodeList, not an array
  for (var i = 0; i < tables.length; i++) {
    if (i == 0) continue;
    var additionalTable = tables[i];

    // Relatives table
    var title = additionalTable.querySelector('.recordSectionTitle');
    if (title && title.textContent.toLowerCase() == 'relatives') {
      var relatives = new VerticalTable(additionalTable.querySelector('table'), {
        labelMapper: function(label){
          return label.toLowerCase().trim();
        },
        valueMapper: function(cell){
          var a = cell.querySelector('a');
          return {
            text: cell.textContent.trim(),
            href: a ? a.href : ''
          };
        }
      });

      relatives.getRows().forEach(function(row) {
        var name = GedcomX.Name.createFromString(row.name.text);
        var person = gedx.findPersonByName(name);
        var personId = getRecordId(row.name.href);
        var identifiers = {
          'genscrape': getRecordIdentifier(row.name.href)
        };

        if (person) {
          // Update their IDs
          gedx.updatePersonsID(person.id, personId);
          person.setIdentifiers(identifiers);
        } else {
          // Add person
          person = new GedcomX.Person({
            id: getRecordId(row.name.href),
            identifiers: identifiers
          });
          person.addSimpleName(row.name.text);
          gedx.addPerson(person);
        }

        // Update their birth/death information
        if (row.birth && row.birth.text) {
          person.addFact(GedcomX.Fact({
            type: 'http://gedcomx.org/Birth',
            date: {
              original: row.birth.text.trim()
            }
          }));
        }
        if (row.death && row.death.text) {
          person.addFact(GedcomX.Fact({
            type: 'http://gedcomx.org/Death',
            date: {
              original: row.death.text.trim()
            }
          }));
        }

        // If there is no relation, return
        if (!row.relation.text) return;

        // Add relationship
        if(/^(husband|wife)/.test(row.relation.text.toLowerCase())) {
          gedx.addRelationship({
            type: 'http://gedcomx.org/Couple',
            person1: primaryPerson,
            person2: person
          });
        }
        if(/^(son|daughter)/.test(row.relation.text.toLowerCase())) {
          gedx.addRelationship({
            type: 'http://gedcomx.org/ParentChild',
            person1: primaryPerson,
            person2: person
          });
        }
        if(/^(mother|father)/.test(row.relation.text.toLowerCase())) {
          gedx.addRelationship({
            type: 'http://gedcomx.org/ParentChild',
            person1: person,
            person2: primaryPerson
          });
        }
      });
    }
  }


  // Agent
  var agent = GedcomX.Agent()
      .setId('agent')
      .addName({
        lang: 'en',
        value: 'MyHeritage'
      })
      .setHomepage({
        resource: 'https://www.myheritage.com'
      });
  gedx.addAgent(agent);

  // Source Citation/Description
  var source = GedcomX.SourceDescription()
    .setAbout(document.location.href)
    .addTitle({
      value: document.querySelector('.collection_title').textContent.trim()
    })
    .addCitation({
      value: 'MyHeritage, database and images (https://www.myheritage.com : accessed ' + utils.getDateString() + ')'
        + ', Record #' + getRecordId(document.location.href) + ' for ' + document.title + '.'
    })
    .setRepository({resource: '#agent'});
  gedx.addSourceDescriptionToAll(source);

  debug('data');
  emitter.emit('data', gedx);
}

function getRecordId(url) {
  var parts = url.match(/\/record-(\d+)-([^\/]+)\//);
  return parts[1] + ':' + parts[2];
}

function getRecordIdentifier(url) {
  return 'genscrape://myheritage:record/' + getRecordId(url);
}

function getGender(raw){
  var gender = (raw.length > 0 ) ? raw.toLowerCase()[0] : '';

  switch(gender) {
    case 'm':
      return 'http://gedcomx.org/Male';
    case 'f':
      return 'http://gedcomx.org/Female';
  }
}