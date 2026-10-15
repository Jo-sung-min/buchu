package kr.co.buchu.submission;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record SubmissionInput(
        String companyName, String businessNumber, String contactName, String contactEmail,
        String contactPhone, String name, String tagline, String description, String officialUrl,
        String category, List<String> channels, String cost, String costLabel,
        String commission, String settlement, String thumbnailUploadId, JsonNode content, List<String> tags,
        String board, String helpType, String location, String deadline
) {
    public SubmissionInput {
        board = board == null || board.isBlank() ? "MARKETER" : board;
        helpType = "HELP".equals(board) ? (helpType == null || helpType.isBlank() ? "PROMOTION" : helpType) : null;
        location = location == null ? "" : location;
        deadline = deadline == null ? "" : deadline;
    }
}
