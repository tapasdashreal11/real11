'use strict';

/**
 * match tastes between two profiles
 * @param profileTaste1 -
 * @param profileTaste2 -
 * @return the percentage of profile1 would like what profile2 likes
 */
module.exports.matchTaste = function (profileTaste1, profileTaste2) {
  var maxDistance = 0;
  var overlap = 0;
  for (var flavor in profileTaste1) {
    if (flavor in profileTaste2) {
      var d = tasteDistance(profileTaste1[flavor], profileTaste2[flavor]);
      var o = tasteOverlap(profileTaste1[flavor], profileTaste2[flavor]);
      overlap += o;
      maxDistance += d + o;
    }
  }
  return maxDistance == 0 ? 0 : overlap / maxDistance;
}

/**
 * match a menu item's flavor to a profile
 * @param profileTaste. data format {flavor : [min, max]}
 * @param menuRating. data format {flavor : rating}
 * @return match percentage (between 0~1) given menu for the profile
 */
module.exports.matchFlavor = function (profileTaste, menuRating) {
  var maxDistance = 1;
  var distance = 0;
  for (var flavor in profileTaste) {
    if (flavor in menuRating) {
      if (flavor !=="constructor"  && flavor!=="toString") {
        distance = flavorDistance(profileTaste[flavor], menuRating[flavor]);
        if(distance < maxDistance )
          maxDistance = distance;
      }
    }
  }
  return (distance == 0) ? 0 : maxDistance;
}

/**
 * calculate the distance between diner's flavor range [min, max] and menu item
 * rating
 * @param flavorRange - data format: [min, max]
 * @param rating - flavor rating
 * @return the distance between the flavor rating and flavorRange
 */
function flavorDistance(flavorRange, rating) {
  var min = flavorRange[0], max = flavorRange[1];

  if(rating >= min)
  {
    if(rating <= max)
      return 1;
    else
      return 1-(rating-max)/100;
  }
  else
    return 1-(min-rating)/100;

}

/**
 * calculate distance to move tasteRange1 to match tasteRange2
 */
function tasteDistance(tasteRange1, tasteRange2) {
  var distance = 0;
  // min distance
  if (tasteRange2[0] < tasteRange1[0]) {
    distance += tasteRange1[0] - tasteRange2[0];
  } else if (tasteRange2[0] > tasteRange1[1]) {
    distance += tasteRange2[0] - tasteRange1[0];
  }
  // max distance
  if (tasteRange2[1] > tasteRange1[1]) {
    distance += tasteRange2[1] - tasteRange1[1];
  } else if (tasteRange2[1] < tasteRange1[0]) {
    distance += tasteRange1[1] - tasteRange2[1];
  }
  return distance;
}

/**
 * calculate overlaps of two ranges
 */
function tasteOverlap(tasteRange1, tasteRange2) {
  var min = Math.max(tasteRange1[0], tasteRange2[0]);
  var max = Math.min(tasteRange1[1], tasteRange2[1]);
  return max > min ? max - min : 0;
}
