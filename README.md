# This is not ready for use. This is a prototype, with a lot of simplifications. It might trash your database, it might publish your private blocks on the interwebs. 


How to deploy:

- run `npm run build`
- grab the file `build/js/app.js` and make it available online somehow (I use Netlify's free plan)
- use this code to pull the JS into Roam

```
- {{[[roam/js]]}}
    - ```javascript
const roamInter = "roaminter-script";
const existingRoamInter = document.getElementById(roamInter);
if(existingRoamInter) document.getElementsByTagName('head')[0].removeChild(existingRoamInter);
var s = document.createElement('script');
	s.type = "text/javascript";
	s.id = roamInter;
    s.src =  "https://roam-inter.netlify.app/app.js";
  	s.async = true;
document.getElementsByTagName('head')[0].appendChild(s);```
```
