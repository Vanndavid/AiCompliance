import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AskDocuments } from './AskDocuments';

interface Props {
  selectedProjectId: number | null;
  searchQuery: string;
  searching: boolean;
  searchSummary: string | null;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
}

export const DocumentTools = ({
  selectedProjectId,
  searchQuery,
  searching,
  searchSummary,
  onSearchQueryChange,
  onSearch,
  onClearSearch,
}: Props) => (
  <Accordion sx={{ mb: 4, border: '1px solid #e0e0e0', boxShadow: 'none' }} disableGutters>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Typography fontWeight={600}>Search and ask documents</Typography>
    </AccordionSummary>
    <AccordionDetails>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Optional tools. The list above is the source of truth for who is site-ready.
      </Typography>
      <Stack spacing={2}>
        <TextField
          fullWidth
          placeholder="Filter files, e.g. licences expiring in 1 month"
          value={searchQuery}
          onChange={event => onSearchQueryChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              onSearch();
            }
          }}
        />
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={onSearch} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </Button>
          <Button variant="outlined" onClick={onClearSearch} disabled={searching && !searchQuery}>
            Clear
          </Button>
        </Stack>
        {searchSummary && <Alert severity="info">{searchSummary}</Alert>}
        <AskDocuments selectedProjectId={selectedProjectId} />
      </Stack>
    </AccordionDetails>
  </Accordion>
);
