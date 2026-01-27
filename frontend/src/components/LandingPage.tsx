import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Chip, 
  Stack, 
  Button,
  Container,
  Divider
} from '@mui/material';

// MUI Icons
import StorageIcon from '@mui/icons-material/Storage'; // S3
import CloudQueueIcon from '@mui/icons-material/CloudQueue'; // React/Web
import MemoryIcon from '@mui/icons-material/Memory'; // Lambda/AI
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'; // Security
import BoltIcon from '@mui/icons-material/Bolt'; // Serverless
import GitHubIcon from '@mui/icons-material/GitHub';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DnsIcon from '@mui/icons-material/Dns'; // Node/Backend
import DataObjectIcon from '@mui/icons-material/DataObject'; // MongoDB
import TerminalIcon from '@mui/icons-material/Terminal'; // Docker/DevOps
import AllInclusiveIcon from '@mui/icons-material/AllInclusive'; // CI/CD
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LoopIcon from '@mui/icons-material/Loop';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; // For Gemini

// Your components
import { AutoLoginButton } from './AutoLoginButton'; 

const LandingPage = () => {
    return (
        <Box sx={{ py: 8 }}>
        
        {/* --- HERO SECTION --- */}
        <Box textAlign="center" mb={10}>
            <Chip 
            icon={<BoltIcon />} 
            label="System Live: AWS Lambda + Gemini Ai" 
            color="primary" 
            variant="outlined" 
            sx={{ mb: 3, fontWeight: 'bold' }}
            />
            
            <Typography variant="h2" component="h1" fontWeight="800" gutterBottom sx={{ letterSpacing: '-1px' }}>
            Event-Driven <br />
            <span style={{ color: '#4f46e5' }}>Compliance Automation</span>
            </Typography>
            
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', mb: 5, lineHeight: 1.6 }}>
            A distributed system that extracts and audits documents in real-time. 
            Built to demonstrate <strong>Serverless Architecture</strong>, <strong>Async Queues</strong>, and <strong>Generative AI</strong>.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="center">
            <Box width={{ xs: '100%', sm: 'auto' }}>
                {/* Use the Pulsing Variant here */}
                <AutoLoginButton disablePulse={true} />
            </Box>
            <Button 
                variant="outlined" 
                size="large" 
                startIcon={<GitHubIcon />}
                href="https://github.com/Vanndavid/AiCompliance"
                target="_blank"
                sx={{ px: 4, py: 1.5, textTransform: 'none', fontWeight: 600 }}
            >
                View Source Code
            </Button>
            </Stack>
        </Box>

        {/* --- ARCHITECTURE DIAGRAM (Updated) --- */}
        <Paper elevation={0} sx={{ p: 4, mb: 4, bgcolor: 'white', border: '1px solid #e0e0e0', borderRadius: 4 }}>
            <Box textAlign="center" mb={6}>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                Full-Stack Event Loop
                </Typography>
                <Typography variant="body2" color="text.secondary">
                Asynchronous processing pipeline with real-time state updates.
                </Typography>
            </Box>

            <Grid container spacing={4} justifyContent="center" alignItems="center">
            
                {/* === ROW 1: INGESTION (Left to Right) === */}
                
                {/* 1. React Client */}
                <Grid item xs={12} md={2.5}>
                <DiagramNode 
                    icon={<CloudQueueIcon fontSize="large" color="primary" />} 
                    label="React Client" 
                    sub="Multipart Upload & Polling" 
                />
                </Grid>

                <Grid item xs={12} md={0.5} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                <ArrowForwardIcon color="disabled" />
                </Grid>

                {/* 2. Node API (The Gatekeeper) */}
                <Grid item xs={12} md={2.5}>
                <DiagramNode 
                    icon={<DnsIcon fontSize="large" sx={{ color: '#339933' }} />} 
                    label="Node.js API" 
                    sub="Auth & Presigned URLs" 
                />
                </Grid>

                <Grid item xs={12} md={0.5} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                <ArrowForwardIcon color="disabled" />
                </Grid>

                {/* 3. S3 Bucket */}
                <Grid item xs={12} md={2.5}>
                <DiagramNode 
                    icon={<StorageIcon fontSize="large" color="info" />} 
                    label="S3 Storage" 
                    sub="Encrypted PDF Storage" 
                />
                </Grid>

                <Grid item xs={12} md={0.5} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                <ArrowForwardIcon color="disabled" />
                </Grid>

                {/* 4. SQS Queue (The Buffer) */}
                <Grid item xs={12} md={2.5}>
                <DiagramNode 
                    icon={<StorageIcon fontSize="large" color="warning" />} 
                    label="AWS SQS" 
                    sub="Job Buffer" 
                />
                </Grid>

         


                {/* === ROW 2: PROCESSING (Right to Left) === */}

                {/* 8. Notification Service (The End) */}
                <Grid item xs={12} md={2.5}>
        
                </Grid>


            {/* 7. MongoDB (The Source of Truth) */}
            <Grid item xs={12} md={2.5}>
                <DiagramNode 
                    icon={<DataObjectIcon fontSize="large" sx={{ color: '#00ED64' }} />} 
                    label="MongoDB" 
                    sub="Stores Extracted Data" 
                />
            </Grid>

            <Grid item xs={12} md={0.5} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                <ArrowBackIcon color="disabled" />
            </Grid>

            {/* 6. Gemini AI (External Service) */}
            <Grid item xs={12} md={2.5}>
            <DiagramNode 
                icon={<AutoAwesomeIcon fontSize="large" sx={{ color: '#8e24aa' }} />} 
                label="Google Gemini" 
                sub="Vision & Extraction" 
            />
            </Grid>

            <Grid item xs={12} md={0.5} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <ArrowBackIcon color="disabled" />
            </Grid>

            {/* 5. Lambda Worker (The Brain) */}
            <Grid item xs={12} md={2.5}>
            <DiagramNode 
                icon={<BoltIcon fontSize="large" color="error" />} 
                label="Lambda Worker" 
                sub="Process SQS Jobs" 
            />
            </Grid>

        </Grid>
        </Paper>

        {/* --- DEVOPS BADGE STRIP (New) --- */}
        <Paper elevation={0} sx={{ py: 3, px: 4, mb: 8, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 3 }}>
            <Grid container alignItems="center" spacing={4}>
                <Grid item xs={12} md={3}>
                    <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" textTransform="uppercase">
                        Infrastructure & CI/CD
                    </Typography>
                </Grid>
                <Grid item xs={12} md={9}>
                    <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
                        <DevOpsBadge icon={<TerminalIcon fontSize="small" />} label="Dockerized" />
                        <DevOpsBadge icon={<AllInclusiveIcon fontSize="small" />} label="GitHub Actions" />
                        <DevOpsBadge icon={<VerifiedUserIcon fontSize="small" />} label="Clerk Auth" />
                        <DevOpsBadge icon={<StorageIcon fontSize="small" />} label="S3 Encrypted" />
                    </Stack>
                </Grid>
            </Grid>
        </Paper>

        {/* --- ENGINEERING DECISIONS --- */}
        <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
            <FeatureCard 
                icon={<DnsIcon color="primary" />}
                title="Express & TypeScript"
                desc="Robust backend API built with strict type safety. Handles rate limiting, validation, and secure presigned URL generation."
            />
            </Grid>
            <Grid item xs={12} md={4}>
            <FeatureCard 
                icon={<StorageIcon color="primary" />}
                title="Queue Throttling"
                desc="Implemented SQS Standard Queues to decouple the heavy AI workload from the user-facing API."
            />
            </Grid>
            <Grid item xs={12} md={4}>
            <FeatureCard 
                icon={<TerminalIcon color="primary" />}
                title="Production Ready"
                desc="Fully Dockerized environment with automated CI/CD pipelines via GitHub Actions for zero-downtime deployments."
            />
            </Grid>
        </Grid>

        </Box>
    );
    };

    // --- Sub Components ---

    const DiagramNode = ({ icon, label, sub }: { icon: React.ReactNode, label: string, sub: string }) => (
    <Paper 
        elevation={0} 
        sx={{ 
        p: 2, 
        textAlign: 'center', 
        border: '1px solid #eee', 
        bgcolor: '#fafafa',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s',
        '&:hover': {
            transform: 'translateY(-5px)',
            borderColor: '#94a3b8'
        }
        }}
    >
        <Box mb={1}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight="bold">{label}</Typography>
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
    </Paper>
    );

    const DevOpsBadge = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#475569' }}>
            {icon}
            <Typography variant="body2" fontWeight="600">{label}</Typography>
        </Box>
    );

    const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
    <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#e0e7ff', mr: 2 }}>
            {icon}
        </Box>
        <Typography variant="h6" fontWeight="bold">
            {title}
        </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
        {desc}
        </Typography>
    </Box>
);

export default LandingPage;