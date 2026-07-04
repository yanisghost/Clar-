/* eslint-disable no-restricted-syntax */
/* eslint-disable node/no-unsupported-features/es-syntax */
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  // For normal .find() queries
  filter() {
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    const queryObj = { ...this.queryString };
    const excludeFields = ['page', 'sort', 'limit', 'fields'];
    excludeFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/"(gte|gt|lte|lt)"/g, '"$$$1"');

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  // ✅ New method: for aggregation pipelines
  filterMatch() {
    const queryObj = { ...this.queryString };
    const excludeFields = ['page', 'sort', 'limit', 'fields'];
    excludeFields.forEach((el) => delete queryObj[el]);

    // Replace operators with $gte, $lte, etc.
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/"(gte|gt|lte|lt)"/g, '"$$$1"'); // keep $$ for now
    const parsed = JSON.parse(queryStr);

    // ✅ Fix operators for aggregation ($ instead of $$)
    const fixOperators = (obj) => {
      // eslint-disable-next-line guard-for-in
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          fixOperators(obj[key]);
        }
        if (key.startsWith('$$')) {
          obj[`$${key.slice(2)}`] = obj[key];
          delete obj[key];
        }
      }
    };
    fixOperators(parsed);

    // ✅ Convert createdAt values to Date objects
    if (parsed.createdAt) {
      if (parsed.createdAt.$gte)
        parsed.createdAt.$gte = new Date(parsed.createdAt.$gte);
      if (parsed.createdAt.$lte)
        parsed.createdAt.$lte = new Date(parsed.createdAt.$lte);
    }

    return parsed; // usable in $match
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('_id');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
