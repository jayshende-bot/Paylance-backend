const ApiError = require('../utils/ApiError');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message.replace(/"/g, ''));
    return next(new ApiError(400, messages.join('. ')));
  }
  next();
};

module.exports = { validate };
