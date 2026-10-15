package kr.co.buchu.course;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import java.io.IOException;
import java.util.List;

public final class CourseModels {
    private CourseModels() {}

    public record CourseLesson(String id, String title, int durationMinutes, boolean preview) {}
    public record CourseModule(String id, String title, List<CourseLesson> lessons) {}
    public record AdminLesson(String id, String title,
            @JsonDeserialize(using = StrictInteger.class) Integer durationMinutes,
            @JsonDeserialize(using = StrictBoolean.class) Boolean preview,
            String body, String videoUrl) {}
    public record AdminModule(String id, String title, List<AdminLesson> lessons) {}
    public record LessonContent(String id, String title, int durationMinutes, boolean preview, String body, String videoUrl) {}
    public record Course(String id, String slug, String title, String subtitle, String description,
            String category, String level, String status, boolean isDemo,
            String instructorName, String instructorBio, String thumbnailUrl, String refundPolicy, String supportEmail,
            int price, int accessDays, int weeklyHours, int startupCost,
            List<String> outcomes, List<String> requirements, String relatedProgramSlug,
            List<CourseModule> curriculum, String createdAt, String updatedAt) {}
    public record CourseInput(String slug, String title, String subtitle, String description,
            String category, String level, String status,
            @JsonDeserialize(using = StrictBoolean.class) Boolean isDemo,
            String instructorName, String instructorBio, String thumbnailUrl, String refundPolicy, String supportEmail,
            @JsonDeserialize(using = StrictInteger.class) Integer price,
            @JsonDeserialize(using = StrictInteger.class) Integer accessDays,
            @JsonDeserialize(using = StrictInteger.class) Integer weeklyHours,
            @JsonDeserialize(using = StrictInteger.class) Integer startupCost,
            List<String> outcomes, List<String> requirements, String relatedProgramSlug,
            List<AdminModule> curriculum) {}
    public record AdminCourse(String id, String slug, String title, String subtitle, String description,
            String category, String level, String status, boolean isDemo,
            String instructorName, String instructorBio, String thumbnailUrl, String refundPolicy, String supportEmail,
            int price, int accessDays, int weeklyHours, int startupCost,
            List<String> outcomes, List<String> requirements, String relatedProgramSlug,
            List<AdminModule> curriculum, String createdAt, String updatedAt) {}
    public record CoursePage(List<Course> items, long total) {}
    public record AdminCoursePage(List<AdminCourse> items, long total) {}

    // Jackson otherwise silently truncates decimals and coerces numeric strings.
    public static final class StrictInteger extends JsonDeserializer<Integer> {
        @Override public Integer deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
                return (Integer) context.handleUnexpectedToken(Integer.class, parser);
            }
            return parser.getIntValue();
        }
    }
    public static final class StrictBoolean extends JsonDeserializer<Boolean> {
        @Override public Boolean deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            if (parser.currentToken() != JsonToken.VALUE_TRUE && parser.currentToken() != JsonToken.VALUE_FALSE) {
                return (Boolean) context.handleUnexpectedToken(Boolean.class, parser);
            }
            return parser.getBooleanValue();
        }
    }
}
