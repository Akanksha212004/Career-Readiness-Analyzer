const aiServiceClient = require("../utils/aiServiceClient");

async function listRoles(req, res, next) {
  try {
    const roles = await aiServiceClient.getRoles();
    res.json({ roles });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRoles };
