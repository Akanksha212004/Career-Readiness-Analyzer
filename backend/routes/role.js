// backend/routes/role.js or inside resume.js
router.get('/search-roles', async (req, res) => {
    const { q, type } = req.query; // q = search text, type = Internship/Job
    try {
        const roles = await Role.find({
            category: type,
            title: { $regex: q, $options: 'i' }
        }).limit(5);
        res.json(roles);
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});