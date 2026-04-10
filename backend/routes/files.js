const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const File = require('../models/File');
const s3 = require('../config/s3');
const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

// @route   POST api/files/upload
// @desc    Upload a file
// @access  Private
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    const { originalname, size, mimetype } = req.file;
    let url = '';
    let s3Key = '';

    if (req.file.location) {
        url = req.file.location;
        s3Key = req.file.key;
    } else {
        url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        s3Key = req.file.filename;
    }

    const newFile = new File({
      filename: req.file.filename || (req.file.key ? req.file.key.split('/').pop() : 'unknown'),
      originalName: originalname,
      s3Key: s3Key,
      url: url,
      size: size,
      mimetype: mimetype,
      owner: req.user.id
    });

    const file = await newFile.save();
    res.json(file);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/files
// @desc    Get all files for a user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const files = await File.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(files);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/files/:id/share
// @desc    Get public link for a file
// @access  Private
router.get('/:id/share', auth, async (req, res) => {
    try {
      const file = await File.findById(req.params.id);
  
      if (!file) return res.status(404).json({ msg: 'File not found' });
  
      if (file.owner.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'Not authorized' });
      }

      const shareLink = `${req.protocol}://${req.get('host')}/api/files/${file._id}/download`;
      res.json({ shareLink });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
});

// @route   GET api/files/:id/download
// @desc    Public route to download/preview a file using a pre-signed URL or local path
// @access  Public
router.get('/:id/download', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ msg: 'File not found' });

    if (s3 && file.s3Key && file.url.includes('amazonaws.com')) {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: file.s3Key,
      });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return res.redirect(signedUrl);
    } 

    return res.redirect(file.url);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/files/:id
// @desc    Delete a file
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) return res.status(404).json({ msg: 'File not found' });

    if (file.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    if (s3 && file.s3Key && file.url.includes('amazonaws.com')) {
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: file.s3Key,
      });
      await s3.send(command);
    } else {
      const filePath = path.join(__dirname, '..', 'uploads', file.s3Key);
      if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
      }
    }

    await File.deleteOne({ _id: req.params.id });
    res.json({ msg: 'File removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
