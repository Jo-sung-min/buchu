package kr.co.buchu.program;

import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;

public record Program(
        String slug,
        String name,
        String tagline,
        String description,
        String category,
        List<String> channels,
        String cost,
        String costLabel,
        String commission,
        String settlement,
        String difficulty,
        boolean featured,
        String officialUrl,
        String guideUrl,
        String brandColor,
        String initials,
        List<String> tags,
        List<String> highlights,
        List<String> steps,
        List<String> cautions,
        String verifiedAt,
        String companyName,
        String thumbnailUrl,
        JsonNode content,
        String board,
        String helpType,
        String location,
        String deadline
) {
    public Program {
        board = board == null || board.isBlank() ? "MARKETER" : board;
        helpType = "HELP".equals(board) ? (helpType == null || helpType.isBlank() ? "PROMOTION" : helpType) : null;
        location = location == null ? "" : location;
        deadline = deadline == null ? "" : deadline;
    }
}
