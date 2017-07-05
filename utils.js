var _  = require('lodash'),
    fs = require('fs'),
  clc  = require('cli-color');

module.exports = {
  slugify: text => {
    var from = 'àáäâèéëêìíïîòóöôùúüûñç',
        to   = 'aaaaeeeeiiiioooouuuunc',
        text = text.toLowerCase();
        
    for (var i=0, l=from.length ; i<l ; i++) {
      text = text.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }
    
    return text.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-{1,}/g,'-')
      .replace(/-$/,'')
      .replace(/^-/, '');
  },

  splitIds: text => _.compact(text.split('|')).map(d => {
    return {
      _id: parseInt(d) 
    }
  }),
  
  cypher: {
    prepare: (query, params) => {
      let relmatching = /\{=([^\}]+)\}/g;
      let q = query.replace(relmatching, (m, c) => {
        return params[c];
      });
      return q
    }
  },

  waterfall:{
    start: (next) => {
      console.log(clc.yellowBright('utils.waterfall.start'));
      next(null, {})
    },
    readJson: (opt, next) => {
      console.log(clc.yellowBright('utils.waterfall.readJson'), opt.filepath);
      fs.readFile(opt.filepath, 'utf8', (err, data) => {
        if(err) 
          next(err)
        else{
          opt.data = JSON.parse(data)
          next(null, opt);
        }   
      });
    }
  }
}